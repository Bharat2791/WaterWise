import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import LoginPage from './LoginPage';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { AlarmClockCheck, AlertCircle, AlertTriangle, Bell, Building2, CalendarDays, Check, Database, Droplets, Gauge, Globe, LoaderCircle, MapPinned, MapPin, Navigation, Save, Search, ShieldCheck, Sparkles, TrendingUp, Users, Wrench, X, Download, ExternalLink, RefreshCw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  try {
    const session = JSON.parse(sessionStorage.getItem('waterwise-user-session') || 'null');
    if (session?.token) config.headers.Authorization = `Bearer ${session.token}`;
  } catch {
    sessionStorage.removeItem('waterwise-user-session');
  }
  return config;
});

const severityColors = {
  LOW: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  MEDIUM: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  HIGH: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  CRITICAL: 'bg-red-500/15 text-red-300 border-red-500/30',
};

function formatNumber(value) {
  if (typeof value === 'number') return new Intl.NumberFormat('en-IN').format(value);
  return value || '0';
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-300/70">Water intelligence</p>
        <h2 className="text-2xl font-semibold text-slate-100">{title}</h2>
      </div>
      {action}
    </div>
  );
}

const complaintAreas = {
  Vashi: [19.077, 73.0094],
  Nerul: [19.033, 73.0211],
  Thane: [19.2183, 72.9781],
  Airoli: [19.1547, 72.9994],
  'Kopar Khairane': [19.1184, 73.0047],
  Sanpada: [19.085, 73.006],
  Belapur: [19.0177, 73.0458],
  Ghansoli: [19.1297, 73.0044],
  Seawoods: [19.0197, 73.0188],
  Turbhe: [19.0676, 73.0055],
  Panvel: [18.9894, 73.1175],
  Kharghar: [19.0473, 73.0699],
};

function knownAreaCoordinates(area) {
  const normalizedArea = area?.trim().toLowerCase();
  const match = Object.entries(complaintAreas).find(([name]) => name.toLowerCase() === normalizedArea);
  return match ? match[1] : undefined;
}

const analysisSteps = [
  'Cleaning complaint text',
  'Detecting issue type',
  'Extracting location and duration',
  'Estimating severity',
  'Preparing explainable findings',
];

function getRequestError(error) {
  return error.response?.data?.detail || error.response?.data?.message || 'The request could not be completed. Check the connection and try again.';
}

function ComplaintSubmissionModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    complaint_text: '',
    date: new Date().toISOString().slice(0, 10),
    location: '',
    affected_people: '100',
    status: 'Open',
  });
  const [locationCoordinates, setLocationCoordinates] = useState(null);
  const [locationMatches, setLocationMatches] = useState([]);
  const [geocoding, setGeocoding] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [stage, setStage] = useState(-1);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape' && !analyzing && !saving) onClose();
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [analyzing, saving, onClose]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (name === 'location') {
      setLocationCoordinates(knownAreaCoordinates(value) || null);
      setLocationMatches([]);
      setLocationMessage('');
    }
    setErrorMessage('');
  }

  async function findLocation() {
    const area = form.location.trim();
    if (!area) {
      setLocationMessage('Enter a place or area in India to search.');
      return;
    }

    setGeocoding(true);
    setLocationMatches([]);
    setLocationMessage('');
    try {
      const query = new URLSearchParams({
        format: 'jsonv2',
        countrycodes: 'in',
        limit: '5',
        q: `${area}, India`,
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`);
      if (!response.ok) throw new Error('Location search is temporarily unavailable. Try again shortly.');
      const results = await response.json();
      const matches = results
        .map((result) => ({
          label: result.display_name,
          latitude: Number(result.lat),
          longitude: Number(result.lon),
        }))
        .filter((result) => Number.isFinite(result.latitude) && Number.isFinite(result.longitude));
      if (!matches.length) {
        setLocationMessage('No matching place was found in India. Check the spelling or add a nearby city.');
        return;
      }
      setLocationMatches(matches);
    } catch (error) {
      setLocationMessage(error.message || 'Could not search for this location. Check your connection and try again.');
    } finally {
      setGeocoding(false);
    }
  }

  async function analyzeComplaint(event) {
    event.preventDefault();
    setErrorMessage('');
    setAnalysis(null);
    setStage(0);
    setAnalyzing(true);
    let currentStage = 0;
    const timer = window.setInterval(() => {
      currentStage = Math.min(currentStage + 1, analysisSteps.length - 1);
      setStage(currentStage);
    }, 450);

    try {
      const response = await api.post('/api/complaints/analyze', {
        complaint_text: form.complaint_text.trim(),
        location: form.location || undefined,
      });
      setAnalysis(response.data.analysis);
      setStage(analysisSteps.length);
    } catch (error) {
      setErrorMessage(getRequestError(error));
      setStage(-1);
    } finally {
      window.clearInterval(timer);
      setAnalyzing(false);
    }
  }

  async function saveComplaint() {
    if (!analysis) return;
    setErrorMessage('');
    setSaving(true);
    const location = form.location.trim() || analysis.location;
    const coordinates = locationCoordinates || knownAreaCoordinates(location);
    if (!coordinates) {
      setErrorMessage('Find and select this place in India before saving so the report is mapped to the correct location.');
      setSaving(false);
      return;
    }
    try {
      const response = await api.post('/api/complaints', {
        complaint_text: form.complaint_text.trim(),
        date: new Date(`${form.date}T12:00:00`).toISOString(),
        location: location === 'Unknown Area' ? form.location.trim() : location,
        latitude: coordinates?.[0],
        longitude: coordinates?.[1],
        affected_people: Number(form.affected_people),
        status: form.status,
      });
      onSaved(response.data);
    } catch (error) {
      setErrorMessage(getRequestError(error));
    } finally {
      setSaving(false);
    }
  }

  const severityClass = severityColors[analysis?.severity] || severityColors.MEDIUM;
  const fieldClass = 'mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !analyzing && !saving) onClose();
      }}
    >
      <section
        aria-labelledby="complaint-modal-title"
        aria-modal="true"
        className="my-auto max-h-[min(92vh,900px)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl shadow-cyan-950/40"
        role="dialog"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-800 bg-slate-900/95 px-6 py-5 backdrop-blur">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-300">Citizen intake</p>
            <h2 className="mt-1 text-xl font-semibold text-white" id="complaint-modal-title">Submit water-supply complaint</h2>
            <p className="mt-1 text-sm text-slate-400">Analyze the report first, then review the interpretation before saving.</p>
          </div>
          <button aria-label="Close complaint form" className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-40" disabled={analyzing || saving} onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form className="space-y-4" onSubmit={analyzeComplaint}>
            <label className="block text-sm font-medium text-slate-200" htmlFor="complaint-text">
              Complaint details <span className="text-rose-300">*</span>
              <textarea
                className={`${fieldClass} min-h-36 resize-y`}
                id="complaint-text"
                maxLength={2000}
                minLength={8}
                name="complaint_text"
                onChange={updateField}
                placeholder="Describe what happened, where, and for how long…"
                required
                value={form.complaint_text}
              />
              <span className="mt-1 block text-right text-xs font-normal text-slate-500">{form.complaint_text.length}/2000</span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-200" htmlFor="complaint-location">
                  <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-cyan-300" />Area in India</span>
                  <input
                    autoComplete="address-level2"
                    className={fieldClass}
                    id="complaint-location"
                    list="complaint-area-suggestions"
                    maxLength={255}
                    name="location"
                    onChange={updateField}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && form.location.trim() && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        findLocation();
                      }
                    }}
                    placeholder="Type any city, area, or locality"
                    value={form.location}
                  />
                  <datalist id="complaint-area-suggestions">
                    {Object.keys(complaintAreas).map((area) => <option key={area} value={area} />)}
                  </datalist>
                </label>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">Search for any place in India to locate it on the map.</span>
                  <button
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-cyan-200 transition hover:border-cyan-500/50 hover:bg-cyan-500/10 disabled:cursor-wait disabled:opacity-60"
                    disabled={geocoding || !form.location.trim()}
                    onClick={findLocation}
                    type="button"
                  >
                    {geocoding ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    {geocoding ? 'Searching…' : 'Find location'}
                  </button>
                </div>
                {locationCoordinates && (
                  <p className="mt-2 text-xs text-emerald-300" role="status">Location selected and ready to map.</p>
                )}
                {locationMessage && (
                  <p className="mt-2 text-xs text-amber-200" role="status">{locationMessage}</p>
                )}
                {locationMatches.length > 0 && (
                  <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-1" aria-label="Location matches">
                    {locationMatches.map((match) => (
                      <button
                        className="block w-full rounded-lg px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-cyan-500/10 hover:text-cyan-100"
                        key={`${match.latitude},${match.longitude},${match.label}`}
                        onClick={() => {
                          setLocationCoordinates([match.latitude, match.longitude]);
                          setLocationMatches([]);
                          setLocationMessage('');
                        }}
                        type="button"
                      >
                        {match.label}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[10px] text-slate-500">Map search © OpenStreetMap contributors · India-only results</p>
              </div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="complaint-date">
                <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-cyan-300" />Reported date</span>
                <input className={fieldClass} id="complaint-date" max={new Date().toISOString().slice(0, 10)} name="date" onChange={updateField} required type="date" value={form.date} />
              </label>
              <label className="block text-sm font-medium text-slate-200" htmlFor="affected-people">
                <span className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-cyan-300" />Residents affected</span>
                <input className={fieldClass} id="affected-people" min="1" max="1000000" name="affected_people" onChange={updateField} required type="number" value={form.affected_people} />
              </label>
              <label className="block text-sm font-medium text-slate-200" htmlFor="complaint-status">
                Initial status
                <select className={fieldClass} id="complaint-status" name="status" onChange={updateField} value={form.status}>
                  <option>Open</option>
                  <option>In Progress</option>
                </select>
              </label>
            </div>

            {errorMessage && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60" disabled={analyzing || saving} type="submit">
                {analyzing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {analyzing ? 'Analyzing report…' : analysis ? 'Re-analyze complaint' : 'Analyze complaint'}
              </button>
              {analysis && (
                <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-500/50 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} onClick={saveComplaint} type="button">
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Saving complaint…' : 'Save complaint'}
                </button>
              )}
            </div>
          </form>

          <aside className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-300"><Sparkles className="h-4 w-4" /></div>
              <div>
                <h3 className="text-sm font-semibold text-white">AI interpretation</h3>
                <p className="text-xs text-slate-500">Rule-based NLP · explainable signals</p>
              </div>
            </div>

            {analyzing ? (
              <div className="mt-6 space-y-4" aria-live="polite">
                {analysisSteps.map((item, index) => (
                  <div className="flex items-center gap-3 text-sm" key={item}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${index < stage ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : index === stage ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300' : 'border-slate-700 text-slate-600'}`}>
                      {index < stage ? <Check className="h-3.5 w-3.5" /> : index === stage ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : index + 1}
                    </span>
                    <span className={index <= stage ? 'text-slate-200' : 'text-slate-500'}>{item}</span>
                  </div>
                ))}
              </div>
            ) : analysis ? (
              <div className="mt-5 space-y-4" aria-live="polite">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Issues detected</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {analysis.issue_types.map((issue) => <span className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-200" key={issue}>{issue}</span>)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Location</p>
                    <p className="mt-1 text-sm font-semibold text-white">{analysis.location}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Duration</p>
                    <p className="mt-1 text-sm font-semibold text-white">{analysis.duration}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Estimated severity</p>
                    <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${severityClass}`}>{analysis.severity}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Confidence</p>
                    <p className="mt-1 text-sm font-semibold text-white">{Math.round(analysis.confidence * 100)}%</p>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-400"><span>Analysis confidence</span><span>{Math.round(analysis.confidence * 100)}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-700" style={{ width: `${Math.round(analysis.confidence * 100)}%` }} />
                  </div>
                </div>
                <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-3">
                  <p className="text-xs font-semibold text-cyan-100">How the system reached this result</p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-300">
                    {analysis.explanation.map((reason) => <li className="flex gap-2" key={reason}><Check className="mt-0.5 h-3 w-3 shrink-0 text-cyan-300" />{reason}</li>)}
                  </ul>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">Decision-support analysis only. Review the original report and use operational judgment before dispatch.</p>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-slate-700 p-5 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-400"><AlarmClockCheck className="h-5 w-5" /></div>
                <p className="mt-3 text-sm font-medium text-slate-300">Analysis will appear here</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">Enter a report and run the analysis to review detected issues, location, duration, severity, and supporting signals.</p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}

const pageLinks = [
  { label: 'Overview', path: '/overview', icon: Sparkles },
  { label: 'Command Center', path: '/command-center', icon: Gauge },
  { label: 'Complaints', path: '/complaints', icon: AlertTriangle },
  { label: 'Live Map', path: '/live-map', icon: MapPinned },
  { label: 'Hotspots', path: '/hotspots', icon: Navigation },
  { label: 'Predictions', path: '/predictions', icon: TrendingUp },
  { label: 'Resource Priority', path: '/resource-priority', icon: ShieldCheck },
  { label: 'Alerts', path: '/alerts', icon: Bell },
  { label: 'Analytics', path: '/analytics', icon: Database },
];

function MapFocus({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, 13, { animate: true });
  }, [center, map]);
  return null;
}

function SeverityMap({ complaints, hotspots = [], selectedHotspot = null, focusComplaint = null, height = '560px' }) {
  const center = focusComplaint && Number.isFinite(focusComplaint.latitude) && Number.isFinite(focusComplaint.longitude)
    ? [focusComplaint.latitude, focusComplaint.longitude]
    : selectedHotspot && Number.isFinite(selectedHotspot.lat) && Number.isFinite(selectedHotspot.lng)
    ? [selectedHotspot.lat, selectedHotspot.lng]
    : [19.075, 73.015];
  const colors = { LOW: '#34d399', MEDIUM: '#fbbf24', HIGH: '#fb923c', CRITICAL: '#f87171' };
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700" style={{ height }}>
      <MapContainer center={center} zoom={11} scrollWheelZoom className="h-full w-full">
        <MapFocus center={center} />
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {hotspots.filter((spot) => Number.isFinite(spot.lat) && Number.isFinite(spot.lng)).map((spot) => (
          <CircleMarker
            center={[spot.lat, spot.lng]}
            key={spot.id}
            pathOptions={{ color: '#22d3ee', fillColor: '#06b6d4', fillOpacity: 0.16, weight: 2 }}
            radius={Math.max(13, Math.min(34, 10 + (spot.complaint_count || 0) / 4))}
          >
            <Popup>
              <strong>{spot.location}</strong><br />
              {spot.complaint_count} clustered complaints<br />
              Dominant issue: {spot.dominant_issue}<br />
              Maintenance risk: {spot.maintenance_risk}
            </Popup>
          </CircleMarker>
        ))}
        {complaints.filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)).map((item) => (
          <CircleMarker
            center={[item.latitude, item.longitude]}
            key={item.id}
            pathOptions={{ color: colors[item.severity] || '#94a3b8', fillColor: colors[item.severity] || '#94a3b8', fillOpacity: 0.85, weight: 1 }}
            radius={7}
          >
            <Popup>
              <strong>Complaint #{item.id}</strong><br />
              {item.location} · {item.severity}<br />
              {item.issue_type}<br />
              {item.status} · {formatNumber(item.affected_people)} residents affected
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

function WorkspacePage({ page, complaints, hotspots, predictions, alerts, analytics, stats, onSubmitComplaint, onRefresh, onOpenComplaint, onLocateComplaint, focusComplaintId, loading }) {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All severities');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [alertFilter, setAlertFilter] = useState('All alerts');
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [reviewedAlerts, setReviewedAlerts] = useState([]);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const focusedComplaint = complaints.find((item) => item.id === focusComplaintId) || null;

  useEffect(() => {
    if (page === '/complaints' && focusedComplaint) setSelectedComplaint(focusedComplaint);
  }, [focusedComplaint, page]);

  const filteredComplaints = useMemo(() => complaints.filter((item) => {
    const query = search.trim().toLowerCase();
    return (!query || `${item.id} ${item.complaint_text} ${item.location} ${item.issue_type}`.toLowerCase().includes(query))
      && (severityFilter === 'All severities' || item.severity === severityFilter)
      && (statusFilter === 'All statuses' || item.status === statusFilter);
  }), [complaints, search, severityFilter, statusFilter]);

  if (page === '/live-map') {
    return (
      <div className="space-y-6">
        <SectionHeader title="Live water-issue map" subtitle="Complaint coordinates and DBSCAN-derived hotspot clusters" action={<button onClick={onRefresh} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-500/50"><RefreshCw className="h-4 w-4" />Refresh data</button>} />
        <div className="flex flex-wrap gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-xs text-slate-300">
          {Object.entries({ LOW: '#34d399', MEDIUM: '#fbbf24', HIGH: '#fb923c', CRITICAL: '#f87171' }).map(([label, color]) => <span className="inline-flex items-center gap-2" key={label}><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{label} complaint</span>)}
          <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-full border-2 border-cyan-400 bg-cyan-400/20" />DBSCAN hotspot</span>
          <span className="ml-auto">{complaints.length} loaded reports · {hotspots.length} hotspot clusters</span>
        </div>
        {complaints.length ? <SeverityMap complaints={complaints} hotspots={hotspots} focusComplaint={focusedComplaint} height="min(68vh, 700px)" /> : <EmptyPanel loading={loading} message="No geocoded complaints are available yet." />}
      </div>
    );
  }

  if (page === '/complaints') {
    return (
      <div className="space-y-6">
        <SectionHeader title="Complaint workspace" subtitle="Search, filter, and inspect citizen reports" action={<button onClick={onSubmitComplaint} className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white">Submit complaint</button>} />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label className="relative block">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input aria-label="Search complaints" className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-cyan-400" onChange={(event) => setSearch(event.target.value)} placeholder="Search complaint, area, issue or ID…" value={search} />
          </label>
          <select aria-label="Filter by severity" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200" onChange={(event) => setSeverityFilter(event.target.value)} value={severityFilter}>
            {['All severities', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => <option key={item}>{item}</option>)}
          </select>
          <select aria-label="Filter by status" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            {['All statuses', 'Open', 'In Progress', 'Resolved'].map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>{['ID / Complaint', 'Area', 'Issue', 'Severity', 'Status', 'Affected', 'Priority', 'Reported'].map((label) => <th className="px-4 py-3" key={label}>{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredComplaints.map((item) => (
                <tr className="cursor-pointer transition hover:bg-slate-800/50" key={item.id} onClick={() => setSelectedComplaint(item)}>
                  <td className="max-w-[360px] px-4 py-3"><span className="font-mono text-xs text-cyan-300">#{item.id}</span><p className="mt-1 truncate text-slate-200">{item.complaint_text}</p></td>
                  <td className="px-4 py-3 text-slate-300">{item.location}</td>
                  <td className="px-4 py-3 text-slate-300">{item.issue_type}</td>
                  <td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] ${severityColors[item.severity] || ''}`}>{item.severity}</span></td>
                  <td className="px-4 py-3 text-slate-300">{item.status}</td>
                  <td className="px-4 py-3 text-slate-300">{formatNumber(item.affected_people)}</td>
                  <td className="px-4 py-3 text-slate-300">{Math.round(item.priority_score || 0)}</td>
                  <td className="px-4 py-3 text-slate-400">{item.date ? new Date(item.date).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {!filteredComplaints.length && <tr><td className="px-4 py-12 text-center text-slate-400" colSpan="8">{loading ? 'Loading complaints…' : 'No complaints match these filters.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">Showing {filteredComplaints.length} of {complaints.length} loaded reports. Select a row to view the report analysis.</p>
        {selectedComplaint && <ComplaintDetails complaint={selectedComplaint} onClose={() => setSelectedComplaint(null)} onMap={() => onLocateComplaint(selectedComplaint)} />}
      </div>
    );
  }

  if (page === '/hotspots') {
    return (
      <div className="space-y-6">
        <SectionHeader title="Hotspot intelligence" subtitle="Spatial clusters calculated from complaint coordinates using DBSCAN" />
        <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
          <SeverityMap complaints={complaints} hotspots={hotspots} selectedHotspot={selectedHotspot} height="520px" />
          <div className="space-y-3">
            {hotspots.map((spot) => <button className={`w-full rounded-2xl border p-4 text-left transition ${selectedHotspot?.id === spot.id ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-slate-800 bg-slate-900/75 hover:border-slate-600'}`} key={spot.id} onClick={() => setSelectedHotspot(spot)}>
              <div className="flex items-center justify-between gap-2"><span className="font-semibold text-white">{spot.location}</span><span className={`rounded-full border px-2 py-1 text-[10px] ${severityColors[spot.maintenance_risk] || ''}`}>{spot.maintenance_risk} RISK</span></div>
              <p className="mt-2 text-sm text-slate-300">{spot.complaint_count} clustered reports · {formatNumber(spot.affected_population)} residents affected</p>
              <p className="mt-1 text-xs text-slate-400">Dominant: {spot.dominant_issue} · {spot.recent_count} in last 7 days</p>
              <div className="mt-3 h-1.5 rounded-full bg-slate-800"><div className="h-1.5 rounded-full bg-cyan-400" style={{ width: `${Math.min(100, spot.hotspot_score)}%` }} /></div>
            </button>)}
            {!hotspots.length && <EmptyPanel loading={loading} message="Not enough nearby reports to form a hotspot cluster." />}
          </div>
        </div>
      </div>
    );
  }

  if (page === '/predictions') {
    const grouped = ['HIGH', 'MEDIUM', 'LOW'].map((risk) => ({ risk, items: predictions.filter((item) => item.risk === risk) }));
    return (
      <div className="space-y-6">
        <SectionHeader title="Maintenance intelligence" subtitle="Area risk estimates based on historical complaints, recency, severity, and impact" />
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100/80">Decision support only: predictions summarize complaint patterns and do not replace field inspections or operational judgment.</p>
        {grouped.map(({ risk, items }) => <section key={risk}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{risk} risk · {items.length} areas</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => <article className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5" key={item.area}>
              <div className="flex items-start justify-between"><div><h4 className="text-lg font-semibold text-white">{item.area}</h4><p className="mt-1 text-xs text-slate-400">{item.complaint_count} reports in dataset</p></div><span className={`rounded-full border px-2.5 py-1 text-[10px] ${severityColors[item.risk] || ''}`}>{item.risk} RISK</span></div>
              <div className="mt-4 flex items-end justify-between"><span className="text-xs uppercase tracking-wider text-slate-500">Risk score</span><span className="text-2xl font-semibold text-white">{Math.round(item.score)}<small className="text-sm text-slate-500">/100</small></span></div>
              <div className="mt-2 h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${Math.min(100, item.score)}%` }} /></div>
              <p className="mt-2 text-xs text-slate-400">Model confidence: {item.confidence}%</p>
              <ul className="mt-4 space-y-2 text-xs text-slate-300">{(item.reasons || []).map((reason) => <li className="flex gap-2" key={reason}><span className="text-cyan-300">•</span>{reason}</li>)}</ul>
            </article>)}
          </div>
        </section>)}
      </div>
    );
  }

  if (page === '/resource-priority') {
    const ranking = analytics.priority_ranking || [];
    const bands = [
      { title: 'Critical attention', subtitle: 'Immediate operational review', items: ranking.filter((item) => item.priority_level === 'CRITICAL') },
      { title: 'High attention', subtitle: 'Maintenance planning recommended', items: ranking.filter((item) => item.priority_level === 'HIGH') },
      { title: 'Medium attention', subtitle: 'Monitor closely', items: ranking.filter((item) => item.priority_level === 'MEDIUM') },
      { title: 'Low attention', subtitle: 'Routine monitoring', items: ranking.filter((item) => item.priority_level === 'LOW') },
    ];
    return (
      <div className="space-y-6">
        <SectionHeader title="Resource priority" subtitle="Transparent area-level ranking to support operational allocation" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{bands.map((band) => <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4" key={band.title}><p className="font-semibold text-white">{band.title}</p><p className="mt-1 text-xs text-slate-400">{band.subtitle}</p><p className="mt-3 text-2xl font-semibold text-cyan-300">{band.items.length}<span className="ml-2 text-xs font-normal text-slate-500">areas</span></p></div>)}</div>
        <div className="space-y-3">{ranking.map((item, index) => <article className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/75 p-4 md:grid-cols-[auto_1fr_auto] md:items-center" key={item.location}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-sm font-semibold text-slate-300">{String(index + 1).padStart(2, '0')}</div>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-white">{item.location}</h3><span className={`rounded-full border px-2 py-1 text-[10px] ${severityColors[item.priority_level] || ''}`}>{item.priority_level} ATTENTION</span></div>
            <p className="mt-1 text-sm text-slate-300">{item.complaint_count} reports · {formatNumber(item.affected_population)} residents impacted · {item.dominant_issue}</p>
            <p className="mt-1 text-xs text-slate-500">{item.reason}</p>
          </div>
          <div className="min-w-32"><div className="text-right text-lg font-semibold text-white">{Math.round(item.priority_score)}<span className="text-xs text-slate-500"> / 100</span></div><div className="mt-2 h-1.5 rounded-full bg-slate-800"><div className="h-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-orange-400" style={{ width: `${Math.min(100, item.priority_score)}%` }} /></div></div>
        </article>)}</div>
      </div>
    );
  }

  if (page === '/alerts') {
    const shownAlerts = alerts.filter((item) => alertFilter === 'All alerts' || item.severity === alertFilter);
    return (
      <div className="space-y-6">
        <SectionHeader title="Operational alert center" subtitle="Review high-impact complaint signals and recommended attention" action={<select aria-label="Filter alerts by severity" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200" onChange={(event) => setAlertFilter(event.target.value)} value={alertFilter}>{['All alerts', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((item) => <option key={item}>{item}</option>)}</select>} />
        <div className="space-y-3">{shownAlerts.map((alert) => {
          const reviewed = reviewedAlerts.includes(alert.id);
          return <article className={`rounded-2xl border p-4 ${reviewed ? 'border-slate-800 bg-slate-950/50 opacity-70' : `bg-slate-900/75 ${severityColors[alert.severity] || 'border-slate-800'}`}`} key={alert.id}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[10px] ${severityColors[alert.severity] || ''}`}>{alert.severity}</span><span className="text-xs text-slate-400">{alert.area}</span>{reviewed && <span className="text-xs text-emerald-300">Reviewed in this session</span>}</div><h3 className="mt-2 font-medium text-white">{alert.description}</h3><p className="mt-1 text-xs text-slate-400">{new Date(alert.timestamp).toLocaleString()} · Related complaint IDs: {(alert.related_complaints || []).join(', ') || 'none'}</p><p className="mt-2 text-sm text-slate-300">{alert.recommended_attention}</p></div>
              <div className="flex gap-2"><button className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800" onClick={() => setReviewedAlerts((current) => reviewed ? current.filter((id) => id !== alert.id) : [...current, alert.id])}>{reviewed ? 'Undo review' : 'Mark reviewed'}</button>{alert.related_complaints?.length > 0 && <button className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/10" onClick={() => onOpenComplaint({ id: alert.related_complaints[0] })}>Open report <ExternalLink className="h-3 w-3" /></button>}</div>
            </div>
          </article>;
        })}
          {!shownAlerts.length && <EmptyPanel loading={loading} message="No alerts match this filter." />}
        </div>
      </div>
    );
  }

  if (page === '/analytics') {
    const maxTrend = Math.max(...analytics.trend_series.map((item) => item.complaints || 0), 1);
    const maxArea = Math.max(...Object.values(stats.areas || {}), 1);
    function exportReport() {
      const records = [['Date', 'Complaints', 'Issues', 'Severity', 'Status', 'Area', 'Affected people'], ...complaints.map((item) => [item.date, item.complaint_text, item.issue_type, item.severity, item.status, item.location, item.affected_people])];
      const csv = records.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'waterwise-analytics.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    }
    return (
      <div className="space-y-6">
        <SectionHeader title="Water-supply analytics" subtitle="Current API-backed trend, issue mix, severity, and area impact" action={<button className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/20" onClick={exportReport}><Download className="h-4 w-4" />Export CSV</button>} />
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5"><h3 className="font-semibold text-white">Daily complaint trend</h3><p className="mt-1 text-xs text-slate-500">Past 15 days · sourced from analytics API</p><div className="mt-6 flex h-56 items-end gap-1.5 border-b border-slate-800">{analytics.trend_series.map((item) => <div className="group relative flex h-full flex-1 items-end" key={item.date}><div className="w-full rounded-t bg-gradient-to-t from-cyan-700 to-cyan-300 transition-opacity group-hover:opacity-80" style={{ height: `${Math.max(3, ((item.complaints || 0) / maxTrend) * 100)}%` }} title={`${item.date}: ${item.complaints} reports`} /><span className="absolute -top-5 left-1/2 hidden -translate-x-1/2 text-[10px] text-slate-300 group-hover:block">{item.complaints}</span></div>)}</div><div className="mt-2 flex justify-between text-[10px] text-slate-500"><span>{analytics.trend_series[0]?.date}</span><span>{analytics.trend_series.at(-1)?.date}</span></div></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5"><h3 className="font-semibold text-white">Issue distribution</h3><div className="mt-5 space-y-4">{(analytics.issue_distribution || []).map((item) => <MetricBar key={item.name} label={item.name} value={item.value} max={Math.max(...(analytics.issue_distribution || []).map((x) => x.value), 1)} color="cyan" />)}</div></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5"><h3 className="font-semibold text-white">Severity distribution</h3><div className="mt-5 space-y-4">{(analytics.severity_distribution || []).map((item) => <MetricBar key={item.name} label={item.name} value={item.value} max={Math.max(...(analytics.severity_distribution || []).map((x) => x.value), 1)} color={item.name.toLowerCase()} />)}</div></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5"><h3 className="font-semibold text-white">Area-wise complaints</h3><div className="mt-5 space-y-4">{Object.entries(stats.areas || {}).sort((a, b) => b[1] - a[1]).map(([area, value]) => <MetricBar key={area} label={area} value={value} max={maxArea} color="cyan" />)}</div></div>
        </div>
        <p className="text-xs text-slate-500">CSV export includes the complaints currently loaded from the API ({complaints.length} records). Verify imported records before operational use.</p>
      </div>
    );
  }

  return <DashboardView page={page} stats={stats} hotspots={hotspots} predictions={predictions} alerts={alerts} analytics={analytics} onSubmitComplaint={onSubmitComplaint} />;
}

function MetricBar({ label, value, max, color }) {
  const colorClasses = { cyan: 'from-cyan-500 to-blue-500', low: 'from-emerald-500 to-emerald-300', medium: 'from-amber-500 to-yellow-300', high: 'from-orange-500 to-amber-400', critical: 'from-red-500 to-rose-400' };
  return <div><div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate text-slate-300">{label}</span><span className="text-slate-200">{formatNumber(value)}</span></div><div className="h-2 rounded-full bg-slate-800"><div className={`h-2 rounded-full bg-gradient-to-r ${colorClasses[color] || colorClasses.cyan}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div></div>;
}

function EmptyPanel({ message, loading }) {
  return <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-sm text-slate-400">{loading ? 'Loading live data…' : message}</div>;
}

function ComplaintDetails({ complaint, onClose, onMap }) {
  return <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/70 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside aria-label="Complaint details" className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-700 bg-slate-900 p-6 shadow-2xl">
      <div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Complaint intelligence</p><h2 className="mt-1 text-xl font-semibold text-white">Report #{complaint.id}</h2></div><button aria-label="Close details" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800" onClick={onClose}><X className="h-5 w-5" /></button></div>
      <blockquote className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm leading-relaxed text-slate-200">“{complaint.complaint_text}”</blockquote>
      <div className="mt-5 grid grid-cols-2 gap-3">{[['Area', complaint.location], ['Issue', complaint.issue_type], ['Severity', complaint.severity], ['Status', complaint.status], ['Duration', complaint.duration], ['Residents affected', formatNumber(complaint.affected_people)], ['Maintenance risk', complaint.predicted_maintenance], ['Priority score', complaint.priority_score]].map(([label, value]) => <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3" key={label}><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-white">{value || 'Not available'}</p></div>)}</div>
      <div className="mt-5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4"><p className="text-sm font-semibold text-cyan-100">Priority rationale</p><p className="mt-2 text-sm leading-relaxed text-slate-300">{complaint.priority_reason || 'No additional rationale was stored for this report.'}</p></div>
      <button className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-cyan-400/50" onClick={onMap}><MapPin className="h-4 w-4" />Locate report on map</button>
    </aside>
  </div>;
}

function DashboardView({ page, stats, hotspots, predictions, alerts, analytics, onSubmitComplaint }) {
  const kpis = [
    { label: 'Total Complaints', value: stats.total_complaints || 0, icon: Droplets },
    { label: 'Open Complaints', value: stats.open_complaints || 0, icon: Bell },
    { label: 'Critical Issues', value: stats.critical_issues || 0, icon: AlertTriangle },
    { label: 'Active Hotspots', value: hotspots.length || 0, icon: MapPinned },
    { label: 'High Maintenance Risk', value: stats.high_risk_areas || 0, icon: Wrench },
    { label: 'Affected Population', value: stats.affected_population || 0, icon: Building2 },
  ];
  const title = page === '/overview' ? 'MUNICIPAL WATER OVERVIEW' : 'WATER INTELLIGENCE COMMAND CENTER';
  return <div className="space-y-6">
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/20">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.28em] text-cyan-300/70">Municipal intelligence · Live intake</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1><p className="mt-2 text-sm text-slate-400">Real-time analytics for urban water-supply issues</p></div><button className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white" onClick={onSubmitComplaint}>Submit complaint</button></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{kpis.map(({ label, value, icon: Icon }) => <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-4" key={label}><div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-400">{label}<Icon className="h-4 w-4 text-cyan-300" /></div><div className="mt-3 text-3xl font-semibold text-white">{formatNumber(value)}</div><p className="mt-1 text-xs text-slate-500">Calculated from complaint records</p></div>)}</div>
    </section>
    <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4"><SectionHeader title="Complaint trend" subtitle="Daily report volume · last 15 days" /><div className="flex h-52 items-end gap-2 border-b border-slate-800">{(analytics.trend_series || []).map((item) => <div className="group relative flex h-full flex-1 items-end" key={item.date}><div className="w-full rounded-t bg-gradient-to-t from-cyan-700 to-cyan-300" style={{ height: `${Math.max(3, (item.complaints / Math.max(...(analytics.trend_series || []).map((row) => row.complaints), 1)) * 100)}%` }} title={`${item.date}: ${item.complaints}`} /><span className="absolute -top-5 left-1/2 hidden -translate-x-1/2 text-[10px] text-white group-hover:block">{item.complaints}</span></div>)}</div></div>
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4"><SectionHeader title="Priority watch" subtitle="Areas with elevated maintenance risk" /><div className="space-y-2">{predictions.slice(0, 5).map((item) => <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-3" key={item.area}><span className="text-sm text-white">{item.area}</span><span className={`rounded-full border px-2 py-1 text-[10px] ${severityColors[item.risk] || ''}`}>{item.risk}</span></div>)}</div></div>
    </section>
    <section className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4"><SectionHeader title="Active hotspots" subtitle="Locations with dense complaint clusters" /><div className="grid gap-3 sm:grid-cols-2">{hotspots.slice(0, 4).map((spot) => <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3" key={spot.id}><p className="font-medium text-white">{spot.location}</p><p className="mt-1 text-xs text-slate-400">{spot.complaint_count} clustered reports · {spot.maintenance_risk} risk</p></div>)}</div></div>
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4"><SectionHeader title="Recent operational alerts" subtitle="High-severity complaints requiring attention" /><div className="space-y-2">{alerts.slice(0, 4).map((alert) => <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3" key={alert.id}><div className="flex justify-between text-xs"><span className="text-white">{alert.area}</span><span className="text-slate-400">{alert.severity}</span></div><p className="mt-1 text-xs text-slate-400">{alert.description}</p></div>)}</div></div>
    </section>
  </div>;
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [complaints, setComplaints] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [analytics, setAnalytics] = useState({ trend_series: [], issue_distribution: [], severity_distribution: [] });
  const [status, setStatus] = useState({ backend: 'Checking', database: 'Checking', ai_engine: 'Checking', gis: 'Checking' });
  const [loading, setLoading] = useState(true);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [focusedComplaintId, setFocusedComplaintId] = useState(null);
  const [userSession, setUserSession] = useState(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem('waterwise-user-session') || 'null');
      if (stored?.token && ['citizen', 'receiver'].includes(stored.role)) return stored;
      sessionStorage.removeItem('waterwise-user-session');
      return null;
    } catch {
      sessionStorage.removeItem('waterwise-user-session');
      return null;
    }
  });
  const activePage = location.pathname;
  const visiblePageLinks = userSession?.role === 'citizen'
    ? pageLinks.filter((item) => item.path === '/complaints')
    : pageLinks;
  const validPages = visiblePageLinks.map((item) => item.path);

  useEffect(() => {
    if (!userSession && activePage !== '/login') navigate('/login', { replace: true });
    else if (userSession && activePage === '/') navigate(userSession.role === 'citizen' ? '/complaints' : '/command-center', { replace: true });
    else if (userSession && activePage === '/login') navigate(userSession.role === 'citizen' ? '/complaints' : '/command-center', { replace: true });
  }, [activePage, userSession, navigate]);

  const refreshDashboard = useCallback(async () => {
    const [health, complaintRes] = await Promise.all([
      api.get('/api/health'),
      api.get('/api/complaints?limit=200'),
    ]);
    setStatus(health.data);
    setComplaints(complaintRes.data);
    if (userSession?.role === 'citizen') {
      setStats({});
      setAlerts([]);
      setHotspots([]);
      setPredictions([]);
      setAnalytics({ trend_series: [], issue_distribution: [], severity_distribution: [] });
      return;
    }

    const [statRes, alertRes, hotspotRes, predictionRes, analyticsRes] = await Promise.all([
      api.get('/api/dashboard/stats'),
      api.get('/api/alerts'),
      api.get('/api/hotspots'),
      api.get('/api/predictions'),
      api.get('/api/analytics'),
    ]);
    setStats(statRes.data);
    setAlerts(alertRes.data);
    setHotspots(hotspotRes.data);
    setPredictions(predictionRes.data);
    setAnalytics(analyticsRes.data);
  }, [userSession]);

  useEffect(() => {
    if (!userSession?.token) {
      setLoading(false);
      return undefined;
    }
    refreshDashboard()
      .catch((error) => {
        setNotification({ type: 'error', message: getRequestError(error) });
      })
      .finally(() => setLoading(false));
    return undefined;
  }, [refreshDashboard, userSession?.token]);

  async function handleComplaintSaved(record) {
    setShowComplaintModal(false);
    setNotification({ type: 'success', message: `Complaint #${record.id} saved. Command-center metrics are refreshing.` });
    try {
      await refreshDashboard();
    } catch (error) {
      setNotification({ type: 'error', message: `Complaint #${record.id} was saved, but dashboard refresh failed: ${getRequestError(error)}` });
    }
  }

  function openComplaint(record) {
    if (!record?.id) return;
    setFocusedComplaintId(record.id);
    navigate('/complaints');
  }

  function locateComplaint(record) {
    if (!record?.id) return;
    setFocusedComplaintId(record.id);
    navigate('/live-map');
  }

  function handleLogin(session) {
    sessionStorage.setItem('waterwise-user-session', JSON.stringify(session));
    setUserSession(session);
    navigate(session.role === 'citizen' ? '/complaints' : '/command-center', { replace: true });
  }

  function handleLogout() {
    sessionStorage.removeItem('waterwise-user-session');
    setUserSession(null);
    navigate('/login', { replace: true });
  }

  const kpis = useMemo(() => [
    { label: 'Total Complaints', value: stats.total_complaints || 0, detail: `${stats.recent_7_days || 0} reported in the last 7 days`, icon: Droplets },
    { label: 'Open Complaints', value: stats.open_complaints || 0, detail: 'Currently unresolved reports', icon: Bell },
    { label: 'Critical Issues', value: stats.critical_issues || 0, detail: 'Marked CRITICAL by analysis', icon: AlertTriangle },
    { label: 'Active Hotspots', value: hotspots.length || 0, detail: 'Current geographic clusters', icon: MapPinned },
    { label: 'High Maintenance Risk', value: stats.high_risk_areas || 0, detail: 'Reports flagged HIGH or CRITICAL', icon: Wrench },
    { label: 'Affected Population', value: stats.affected_population || 0, detail: 'Residents reported as impacted', icon: Building2 },
  ], [stats, hotspots]);

  if (activePage === '/login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (!userSession) {
    return <Navigate to="/login" replace />;
  }

  if (userSession.role === 'citizen' && !validPages.includes(activePage)) {
    return <Navigate to="/complaints" replace />;
  }

  if (activePage !== '/' && !validPages.includes(activePage)) {
    return <Navigate to="/command-center" replace />;
  }

  const chartData = analytics.trend_series || [];
  const severityData = analytics.severity_distribution || [];
  const issueData = analytics.issue_distribution || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 xl:px-8">
        <aside className="w-72 rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 shadow-lg shadow-cyan-500/30">
              <Droplets className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight">WATERWISE AI</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Water Intelligence Platform</div>
            </div>
          </div>

          <nav aria-label="Main navigation" className="space-y-2">
            {visiblePageLinks.map(({ label, path, icon: Icon }) => (
              <NavLink
                className={({ isActive }) => `flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition ${isActive ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
                key={path}
                to={path}
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">System status</p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <div className="flex items-center justify-between"><span>Database</span><span className="text-emerald-300">{status.database === 'Connected' ? 'Connected' : status.database}</span></div>
              <div className="flex items-center justify-between"><span>AI Engine</span><span className="text-emerald-300">{status.ai_engine}</span></div>
              <div className="flex items-center justify-between"><span>GIS</span><span className="text-emerald-300">{status.gis}</span></div>
            </div>
            <div className="mt-4 border-t border-slate-800 pt-3">
              <p className="truncate text-xs font-medium text-slate-200">{userSession.email}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{userSession.role === 'citizen' ? 'Complaint giver' : 'Complaint receiver'}</p>
              <button className="mt-3 w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-slate-500 hover:bg-slate-800" onClick={handleLogout} type="button">Sign out</button>
            </div>
          </div>
        </aside>

        <main className="flex-1 space-y-6">
          <header className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-slate-950/30 backdrop-blur-xl">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/30">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-300/80">System status</div>
                  <div className="flex items-center gap-2 text-sm text-slate-300"><span className={`h-2.5 w-2.5 rounded-full ${status.ai_engine === 'Ready' ? 'bg-emerald-400' : 'bg-amber-400'}`} />AI Engine {status.ai_engine === 'Ready' ? 'Online' : 'Degraded'}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2">Last update: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2">Area: Navi Mumbai</div>
                <button className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 font-medium text-white shadow-lg shadow-cyan-600/20 transition hover:brightness-110" onClick={() => setShowComplaintModal(true)} type="button"><Sparkles className="h-4 w-4" />Submit Complaint</button>
              </div>
            </div>
          </header>

          {activePage === '/command-center' ? <>
          <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/20">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-300/70">Municipal intelligence</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">WATER INTELLIGENCE COMMAND CENTER</h1>
              </div>
              <div className="flex gap-3">
                <button className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">7D</button>
                <button className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">30D</button>
                <button className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">Custom</button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {kpis.map(({ label, value, detail, icon: Icon }) => (
                <div key={label} className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-4 shadow-lg shadow-cyan-950/10">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">{label}</div>
                    <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-300"><Icon className="h-4 w-4" /></div>
                  </div>
                  <div className="mt-4 text-3xl font-semibold text-white">{formatNumber(value)}</div>
                  <div className="mt-2 text-xs text-slate-400">{detail}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.8fr_0.8fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
              <SectionHeader title="Live Operational Map" subtitle="Complaint and hotspot intelligence" />
              <SeverityMap complaints={complaints} hotspots={hotspots} height="440px" />
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
              <SectionHeader title="Live Alerts" subtitle="Operational attention" />
              <div className="space-y-3">
                {(alerts.length ? alerts : [{ id: 'none', severity: 'LOW', area: 'System', description: 'No immediate operational alerts in current dataset', recommended_attention: 'Continue routine monitoring.' }]).map((alert) => (
                  <div key={alert.id} className={`rounded-2xl border p-3 ${severityColors[alert.severity] || 'bg-slate-700/20 text-slate-300 border-slate-700'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[10px] uppercase tracking-[0.18em]">{alert.severity}</div>
                      <div className="text-[10px] text-slate-400">{alert.area}</div>
                    </div>
                    <div className="mt-2 text-sm font-medium">{alert.description}</div>
                    <div className="mt-2 text-xs text-slate-300/80">{alert.recommended_attention}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
              <SectionHeader title="Complaint Trend" />
              <div className="h-72 rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
                <div className="flex h-full items-end justify-between gap-2">
                  {(chartData.length ? chartData : [{ date: 'N/A', complaints: 0 }]).map((item) => (
                    <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
                      <div className="w-full rounded-t-xl bg-gradient-to-t from-cyan-500 to-sky-400/70" style={{ height: `${Math.max(10, (item.complaints || 0) * 18)}px` }} />
                      <span className="text-[10px] text-slate-400">{item.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
              <SectionHeader title="Issue Distribution" />
              <div className="space-y-3">
                {(issueData.length ? issueData : [{ name: 'Water Shortage', value: 0 }]).map((item) => (
                  <div key={item.name}>
                    <div className="mb-1 flex justify-between text-sm"><span className="text-slate-300">{item.name}</span><span className="text-cyan-300">{item.value}</span></div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${Math.min(100, (item.value / Math.max(...(issueData.map((x) => x.value || 0)), 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
              <SectionHeader title="Severity Distribution" />
              <div className="space-y-3">
                {(severityData.length ? severityData : [{ name: 'LOW', value: 0 }, { name: 'MEDIUM', value: 0 }, { name: 'HIGH', value: 0 }, { name: 'CRITICAL', value: 0 }]).map((item) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${severityColors[item.name] || 'bg-slate-700/10 text-slate-300'}`}>{item.name}</div>
                    <div className="flex-1 h-2 rounded-full bg-slate-800"><div className={`h-2 rounded-full ${item.name === 'LOW' ? 'bg-emerald-500' : item.name === 'MEDIUM' ? 'bg-amber-500' : item.name === 'HIGH' ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, (item.value / Math.max(...(severityData.map((x) => x.value || 0)), 1)) * 100)}%` }} /></div>
                    <span className="w-8 text-right text-sm text-slate-300">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
              <SectionHeader title="Priority Areas" />
              <div className="space-y-3">
                {(predictions.length ? predictions : [{ area: 'No data', score: 0, risk: 'LOW', complaint_count: 0 }]).map((item) => (
                  <div key={item.area} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">{item.area}</span>
                      <span className={`rounded-full border px-2 py-1 text-[10px] uppercase ${severityColors[item.risk] || 'bg-slate-700/10 text-slate-300 border-slate-700'}`}>{item.risk}</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-300">Priority score {item.score || 0}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.complaint_count || 0} complaints</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
            <SectionHeader title="Hotspot Ranking" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(hotspots.length ? hotspots : [{ id: 'none', location: 'No data', complaint_count: 0, hotspot_score: 0, maintenance_risk: 'LOW' }]).map((hotspot) => (
                <div key={hotspot.id || hotspot.location} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-white">{hotspot.location}</div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] uppercase ${severityColors[hotspot.maintenance_risk] || 'bg-slate-700/10 text-slate-300 border-slate-700'}`}>{hotspot.maintenance_risk}</span>
                  </div>
                  <div className="mt-3 text-sm text-slate-300">{hotspot.complaint_count || 0} complaints</div>
                  <div className="mt-1 text-xs text-slate-400">Dominant issue: {hotspot.dominant_issue || 'N/A'}</div>
                  <div className="mt-2 h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${Math.min(100, hotspot.hotspot_score || 0)}%` }} /></div>
                </div>
              ))}
            </div>
          </section>
          </> : <WorkspacePage
            alerts={alerts}
            analytics={analytics}
            complaints={complaints}
            loading={loading}
            onOpenComplaint={openComplaint}
            onRefresh={() => refreshDashboard().catch((error) => setNotification({ type: 'error', message: getRequestError(error) }))}
            onSubmitComplaint={() => setShowComplaintModal(true)}
            page={activePage}
            predictions={predictions}
            stats={stats}
            hotspots={hotspots}
            focusComplaintId={focusedComplaintId}
            onLocateComplaint={locateComplaint}
          />}
        </main>
      </div>
      {notification && (
        <div className={`fixed bottom-5 right-5 z-40 flex max-w-md items-start gap-3 rounded-2xl border p-4 shadow-2xl ${notification.type === 'success' ? 'border-emerald-500/30 bg-slate-900 text-emerald-100' : 'border-rose-500/30 bg-slate-900 text-rose-100'}`} role="status">
          {notification.type === 'success' ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />}
          <p className="text-sm">{notification.message}</p>
          <button aria-label="Dismiss notification" className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={() => setNotification(null)} type="button"><X className="h-4 w-4" /></button>
        </div>
      )}
      {showComplaintModal && (
        <ComplaintSubmissionModal
          onClose={() => setShowComplaintModal(false)}
          onSaved={handleComplaintSaved}
        />
      )}
    </div>
  );
}

export default App;

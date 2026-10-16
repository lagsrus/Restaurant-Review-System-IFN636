import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../axiosConfig';
import { useAuth } from '../context/AuthContext';

function ReportQueue({ token }) {
  const [view, setView] = useState('open');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  const [deleting, setDeleting] = useState(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setReports([]);
    axiosInstance.get(view === 'history' ? '/api/admin/reports/history' : '/api/admin/reports', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(response => {
      if (active) setReports(response.data);
    }).catch(err => {
      if (active) setError(err.response?.data?.message || 'Could not load reports.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [token, refreshCount, view]);

  const process = async (reportId, action) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await axiosInstance.patch(`/api/admin/reports/${reportId}`, { action }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (mounted.current) setMessage(response.data.message);
    } catch (err) {
      if (mounted.current) {
        setError(err.response?.data?.message ||
          'The result could not be confirmed. Refresh the reports before trying again.');
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setSaving(false);
        setDeleting(null);
        // Also refresh after failure: a sequential operation may have partly succeeded.
        setRefreshCount(count => count + 1);
      }
    }
  };

  const busy = loading || saving;
  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">Review Moderation</h1>
        <button disabled={busy} className="border rounded px-4 py-2 disabled:opacity-50"
          onClick={() => { setError(''); setMessage(''); setDeleting(null); setRefreshCount(count => count + 1); }}>
          Refresh reports
        </button>
      </div>
      <p className="mb-4">Review open reports and decide whether to dismiss the report, hide the review or delete it.</p>
      <div className="flex gap-3 mb-4" aria-label="Report views">
        {[['open', 'Open reports'], ['history', 'Processed reports']].map(([value, label]) => (
          <button key={value} disabled={busy || view === value} aria-pressed={view === value}
            className={`border rounded px-4 py-2 disabled:opacity-50 ${view === value ? 'bg-blue-600 text-white' : ''}`}
            onClick={() => {
              setReports([]); setError(''); setMessage(''); setDeleting(null); setView(value);
            }}>{label}</button>
        ))}
      </div>
      {loading && <p role="status">Loading reports...</p>}
      {saving && <p role="status">Processing report...</p>}
      {message && <p role="status" className="text-green-800 mb-4">{message}</p>}
      {error && <p role="alert" className="text-red-700 mb-4">{error}</p>}
      {!loading && !error && reports.length === 0 && <p>{view === 'history' ? 'No processed reports.' : 'No open reports.'}</p>}

      {!loading && reports.map(report => {
        const review = report.reviewId;
        if (view === 'history') {
          const decisions = { dismiss: 'Report dismissed', hide: 'Review hidden', delete: 'Review deleted' };
          return (
            <article key={report._id} className="border rounded p-4 mb-4 bg-white shadow-sm">
              <h2 className="text-xl font-semibold">{decisions[report.decision] || 'Decision not recorded'}</h2>
              <p className="text-sm text-gray-600 break-all">Report ID: {report._id}</p>
              <p><strong>Status:</strong> {report.status}</p>
              <p><strong>Processed by:</strong> {report.resolvedBy?.name || 'Administrator unavailable'}</p>
              <p><strong>Processed at:</strong> {report.resolvedAt ? new Date(report.resolvedAt).toLocaleString() : 'Time not recorded'}</p>
              <p><strong>Reason:</strong> {report.reason}</p>
              <p className="whitespace-pre-wrap break-words"><strong>Report note:</strong> {report.note || 'No additional note.'}</p>
              {review ? <>
                <p><strong>Restaurant:</strong> {review.restaurantId?.name || 'Restaurant unavailable'}</p>
                <p className="whitespace-pre-wrap break-words"><strong>Review:</strong> {review.comment}</p>
              </> : <p>Review content is no longer available. The recorded moderation decision is retained.</p>}
            </article>
          );
        }
        return (
          <article key={report._id} className="border rounded p-4 mb-4 bg-white shadow-sm">
            <h2 className="text-xl font-semibold">{review?.restaurantId?.name || 'Restaurant unavailable'}</h2>
            <p><strong>Reported by:</strong> {report.reporterId?.name || 'User unavailable'}</p>
            <p><strong>Reason:</strong> {report.reason}</p>
            <p className="whitespace-pre-wrap break-words"><strong>Report note:</strong> {report.note || 'No additional note.'}</p>
            <p className="text-sm text-gray-600">Reported: {new Date(report.createdAt).toLocaleString()}</p>
            {review ? (
              <div className="my-4 border-l-4 pl-4">
                <p><strong>Review by:</strong> {review.userId?.name || 'User unavailable'}</p>
                <p><strong>Visibility:</strong> {review.status}</p>
                <p className="whitespace-pre-wrap break-words">{review.comment}</p>
                <p>Food: {review.ratings?.food} · Service: {review.ratings?.service} · Ambience: {review.ratings?.ambience} · Value: {review.ratings?.value}</p>
                {review.ownerReply?.text && <p className="whitespace-pre-wrap break-words"><strong>Owner reply:</strong> {review.ownerReply.text}</p>}
              </div>
            ) : <p className="my-4">{report.decision === 'delete'
              ? 'The review was removed. Retry Delete review to finish recording the decision.'
              : 'This review is no longer available. You can dismiss this report to close it.'}</p>}
            {report.decision === 'delete' && <p className="mt-3">Deletion pending. Retry Delete review to complete this report.</p>}
            <div className="flex flex-wrap gap-3 mt-4">
              <button disabled={busy || !!deleting || report.decision === 'delete'} onClick={() => process(report._id, 'dismiss')}
                className="border rounded px-4 py-2 disabled:opacity-50">Dismiss report</button>
              <button disabled={busy || !!deleting || !review || report.decision === 'delete'} onClick={() => process(report._id, 'hide')}
                className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50">Hide review</button>
              <button disabled={busy || !!deleting || (!review && report.decision !== 'delete')} onClick={() => setDeleting(report._id)}
                className="border border-red-600 text-red-700 rounded px-4 py-2 disabled:opacity-50">Delete review</button>
            </div>
            {deleting === report._id && (
              <div role="alertdialog" aria-modal="false" aria-label="Confirm review deletion" className="border border-red-300 rounded p-4 mt-4">
                <p>Delete this review permanently? Its owner reply will also be removed. This cannot be undone.</p>
                <div className="flex gap-3 mt-3">
                  <button disabled={busy} onClick={() => process(report._id, 'delete')}
                    className="bg-red-600 text-white rounded px-4 py-2 disabled:opacity-50">Confirm deletion</button>
                  <button disabled={busy} onClick={() => setDeleting(null)} className="border rounded px-4 py-2">Cancel</button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </main>
  );
}

export default function AdminReports() {
  const { user } = useAuth();
  if (!user?.token) {
    return <p className="p-6">Please <Link to="/login" className="text-blue-600 underline">log in</Link> as an admin to view reports.</p>;
  }
  if (user.role !== 'admin') return <p role="alert" className="p-6">Only administrators can view reports.</p>;
  // A different identity unmounts the old queue and ignores its pending responses.
  return <ReportQueue key={user.token} token={user.token} />;
}

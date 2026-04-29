import React, { useState, useRef } from 'react';
import axios from 'axios';
import { X, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

const TIME_RE = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
const isValidTime = (t) => !t || TIME_RE.test(t); // empty is OK (optional)

const formatDateToDisplay = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

export default function CorrectionRequestModal({ onClose, onSubmit ,  initialDate = ''}) {
  const dateInputRef = useRef(null);

  const [formData, setFormData] = useState({
    date:             initialDate,
    // FIX 1: field names corrected to match what the API expects
    correctedInTime:  '',   // was: fromTime
    correctedOutTime: '',   // was: toTime
    reason:           ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.date) {
      toast.error('Please select a date');
      return;
    }

    // FIX 2: require AT LEAST one time, not both
    // The API derives correctionType ('In' | 'Out' | 'Both') from whichever fields are present
    if (!formData.correctedInTime && !formData.correctedOutTime) {
      toast.error('Please provide at least one corrected time (check-in or check-out)');
      return;
    }

    if (!isValidTime(formData.correctedInTime) || !isValidTime(formData.correctedOutTime)) {
      toast.error('Times must be in HH:mm format (e.g. 09:00)');
      return;
    }

    if (!formData.reason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    setLoading(true);
    try {
    
      // Send only the fields the API expects; omit empty strings so the backend
      // correctly derives correctionType as 'In', 'Out', or 'Both'
      const payload = {
        date:   formData.date,
        reason: formData.reason.trim(),
        ...(formData.correctedInTime  && { correctedInTime:  formData.correctedInTime }),
        ...(formData.correctedOutTime && { correctedOutTime: formData.correctedOutTime })
      };

      await axios.post('/api/requests/correction/submit', payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      toast.success('Correction request submitted successfully');
      onSubmit();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit correction request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-800">Request Correction</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div
                onClick={() => dateInputRef.current?.showPicker()}
                className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition bg-white"
              >
                <span className={formData.date ? 'text-gray-800' : 'text-gray-400'}>
                  {formData.date ? formatDateToDisplay(formData.date) : 'dd/mm/yyyy'}
                </span>
                <Calendar size={16} className="text-gray-400" />
              </div>
              <input
                ref={dateInputRef}
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                max={new Date().toISOString().split('T')[0]}
                className="absolute opacity-0 pointer-events-none inset-0 w-full"
              />
            </div>
          </div>

          {/* Times — FIX 2: both are optional individually; at least one required */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Corrected Times
              <span className="text-gray-400 font-normal ml-1">(fill one or both)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Check-in</label>
                <div className="relative">
                  <input
                    type="time"
                    // FIX 1: field name matches API — correctedInTime (was: fromTime)
                    name="correctedInTime"
                    value={formData.correctedInTime}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Check-out</label>
                <div className="relative">
                  <input
                    type="time"
                    // FIX 1: field name matches API — correctedOutTime (was: toTime)
                    name="correctedOutTime"
                    value={formData.correctedOutTime}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Leave blank for whichever time doesn't need correcting.
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              required
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              placeholder="Explain why this correction is needed…"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
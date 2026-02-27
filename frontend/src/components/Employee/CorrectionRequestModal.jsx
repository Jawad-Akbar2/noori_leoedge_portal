import React, { useState, useRef } from 'react';
import axios from 'axios';
import { X, Clock, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CorrectionRequestModal({ onClose, onSubmit }) {
  const dateInputRef = useRef(null);
  const [formData, setFormData] = useState({
    date: '',
    fromTime: '',
    toTime: '',
    reason: ''
  });
  const [loading, setLoading] = useState(false);

  const formatDateToDisplay = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isValidTime = (time) => {
    const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(time);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.date) {
      toast.error('Please select a date');
      return;
    }

    if (!formData.fromTime || !formData.toTime) {
      toast.error('Please provide corrected times');
      return;
    }

    if (!isValidTime(formData.fromTime) || !isValidTime(formData.toTime)) {
      toast.error('Times must be in HH:mm format');
      return;
    }

    if (!formData.reason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        '/api/requests/correction/submit',
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

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
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Request Correction</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <div className="relative">
              <div 
                onClick={() => dateInputRef.current.showPicker()}
                className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer bg-white"
              >
                <span className={formData.date ? "text-gray-900" : "text-gray-400"}>
                  {formData.date ? formatDateToDisplay(formData.date) : 'dd/mm/yyyy'}
                </span>
                <Calendar size={18} className="text-gray-400" />
              </div>
              <input
                ref={dateInputRef}
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                max={new Date().toISOString().split('T')[0]}
                className="absolute opacity-0 pointer-events-none inset-0 w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Time</label>
              <input
                type="text"
                name="fromTime"
                value={formData.fromTime}
                onChange={handleChange}
                placeholder="09:00"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">HH:mm format</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Time</label>
              <input
                type="text"
                name="toTime"
                value={formData.toTime}
                onChange={handleChange}
                placeholder="18:00"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">HH:mm format</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              required
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Explain why you need this correction..."
            ></textarea>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { UserProfile, AuthService } from '../services/firebase';
import { User, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface EditProfileModalProps {
    user: UserProfile;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (user: UserProfile) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ user, isOpen, onClose, onUpdate }) => {
    const [newName, setNewName] = useState(user.displayName);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim() || newName.length > 15) {
            setError("Name must be 1-15 characters.");
            return;
        }

        setLoading(true);
        setError('');

        try {
            await AuthService.updateProfileName(newName.trim());
            // Optimistic update wrapper
            onUpdate({ ...user, displayName: newName.trim() });
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to update name");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-display text-white flex items-center gap-2">
                            <User size={20} className="text-purple-400" />
                            Edit Profile
                        </h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Display Name</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 focus:outline-none"
                            />
                            <p className="text-[10px] text-slate-500 mt-1 text-right">{newName.length}/15</p>
                        </div>

                        {error && <p className="text-red-400 text-xs">{error}</p>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                            Save Changes
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

import React, { useState } from 'react';
import { Gift, Plus, Edit, Calendar, Coins, Trash2 } from 'lucide-react';
import { CreatorBenefitsService } from '../services/creatorBenefitsService';

const CreatorManagement = ({ creatorBenefits, onRefresh }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCreator, setEditingCreator] = useState(null);
  const [form, setForm] = useState({ email: '', tokens: '', proDays: '' });

  const handleAddCreator = async () => {
    if (!form.email || !form.tokens || !form.proDays) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const result = await CreatorBenefitsService.createCreatorBenefit(
        form.email,
        form.tokens,
        form.proDays
      );

      if (result.error) {
        alert('Failed to add creator: ' + result.error);
      } else {
        alert('✅ Creator benefits added successfully!');
        setForm({ email: '', tokens: '', proDays: '' });
        setShowAddForm(false);
        onRefresh();
      }
    } catch (error) {
      console.error('Error adding creator:', error);
      alert('Failed to add creator');
    }
  };

  const handleUpdateTokens = async (email) => {
    const additionalTokens = prompt('Enter number of tokens to add:');
    if (!additionalTokens || isNaN(additionalTokens)) return;

    try {
      const result = await CreatorBenefitsService.updateTokens(email, additionalTokens);
      if (result.error) {
        alert('Failed to update tokens: ' + result.error);
      } else {
        alert(`✅ Added ${additionalTokens} tokens successfully!`);
        onRefresh();
      }
    } catch (error) {
      console.error('Error updating tokens:', error);
      alert('Failed to update tokens');
    }
  };

  const handleExtendPro = async (email) => {
    const additionalDays = prompt('Enter number of days to extend pro access:');
    if (!additionalDays || isNaN(additionalDays)) return;

    try {
      const result = await CreatorBenefitsService.extendProAccess(email, additionalDays);
      if (result.error) {
        alert('Failed to extend pro access: ' + result.error);
      } else {
        alert(`✅ Extended pro access by ${additionalDays} days!`);
        onRefresh();
      }
    } catch (error) {
      console.error('Error extending pro access:', error);
      alert('Failed to extend pro access');
    }
  };

  const handleDeleteCreator = async (email) => {
    if (!confirm(`Are you sure you want to delete creator benefits for ${email}?`)) {
      return;
    }

    try {
      const result = await CreatorBenefitsService.deleteCreatorBenefit(email);
      if (result.error) {
        alert('Failed to delete creator: ' + result.error);
      } else {
        alert('✅ Creator benefits deleted successfully!');
        onRefresh();
      }
    } catch (error) {
      console.error('Error deleting creator:', error);
      alert('Failed to delete creator');
    }
  };

  return (
    <div className="admin-creators">
      <div className="admin-section-header">
        <h3>Content Creator Management</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="admin-add-creator-btn"
          style={{
            background: 'linear-gradient(45deg, #6366f1, #8b5cf6)',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          <Plus className="w-4 h-4" />
          Add Creator
        </button>
      </div>

      {/* Add Creator Form */}
      {showAddForm && (
        <div className="admin-add-form" style={{
          background: '#1f2937',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #374151',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          color: 'white'
        }}>
          <h4>Add New Creator Benefits</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: 'white' }}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({...form, email: e.target.value})}
                placeholder="creator@example.com"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #4b5563',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: '#374151',
                  color: 'white'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: 'white' }}>Tokens</label>
              <input
                type="number"
                value={form.tokens}
                onChange={(e) => setForm({...form, tokens: e.target.value})}
                placeholder="1000"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #4b5563',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: '#374151',
                  color: 'white'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: 'white' }}>Pro Days</label>
              <input
                type="number"
                value={form.proDays}
                onChange={(e) => setForm({...form, proDays: e.target.value})}
                placeholder="30"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #4b5563',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: '#374151',
                  color: 'white'
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleAddCreator}
              style={{
                background: '#10b981',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Add Creator
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setForm({ email: '', tokens: '', proDays: '' });
              }}
              style={{
                background: '#6b7280',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Creator Benefits List */}
      {creatorBenefits.length === 0 ? (
        <div className="admin-empty-state" style={{
          textAlign: 'center',
          padding: '40px',
          background: '#1f2937',
          borderRadius: '8px',
          border: '1px solid #374151',
          color: 'white'
        }}>
          <Gift className="w-16 h-16 mb-4 opacity-50" style={{ margin: '0 auto' }} />
          <h4>No Creator Benefits Yet</h4>
          <p>Add creator benefits to help content creators get started with your platform.</p>
        </div>
      ) : (
        <div className="admin-creators-grid" style={{
          display: 'grid',
          gap: '15px'
        }}>
          {creatorBenefits.map((creator) => {
            const isProValid = CreatorBenefitsService.isProAccessValid(creator);
            
            return (
              <div key={creator.email} className="creator-card" style={{
                background: '#1f2937',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid #374151',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                color: 'white'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '16px', fontWeight: '600', color: 'white' }}>{creator.email}</h4>
                    <div style={{ display: 'flex', gap: '15px', fontSize: '14px', color: '#9ca3af' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Coins className="w-4 h-4" />
                        {creator.tokens} tokens
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Calendar className="w-4 h-4" />
                        Pro until {CreatorBenefitsService.formatExpiryDate(creator.pro_expiry_date)}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: creator.is_used ? '#fee2e2' : '#dcfce7',
                      color: creator.is_used ? '#dc2626' : '#16a34a'
                    }}>
                      {creator.is_used ? 'Used' : 'Available'}
                    </span>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: isProValid ? '#dbeafe' : '#fef3c7',
                      color: isProValid ? '#2563eb' : '#d97706'
                    }}>
                      {creator.tier}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleUpdateTokens(creator.email)}
                    style={{
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Coins className="w-3 h-3" />
                    Add Tokens
                  </button>
                  
                  <button
                    onClick={() => handleExtendPro(creator.email)}
                    style={{
                      background: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Calendar className="w-3 h-3" />
                    Extend Pro
                  </button>

                  <button
                    onClick={() => handleDeleteCreator(creator.email)}
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>

                {creator.is_used && (
                  <div style={{ marginTop: '10px', padding: '10px', background: '#374151', borderRadius: '6px', fontSize: '12px', color: '#9ca3af' }}>
                    Used by: {creator.used_by} on {new Date(creator.used_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CreatorManagement;
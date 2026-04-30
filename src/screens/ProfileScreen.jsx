import { useState, useEffect } from 'react'
import { 
  User, MapPin, Heart, Clock, Edit2, Plus, Trash2, ArrowLeft, 
  Package, Star, Navigation, Phone, Mail, Shield
} from 'lucide-react'
import { C } from '../constants/colors.js'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { Btn } from '../components/Btn.jsx'
import Modal from '../components/Modal.jsx'

export default function ProfileScreen({ onBack }) {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('history')
  const [addresses, setAddresses] = useState([])
  const [favorites, setFavorites] = useState([])
  const [orderHistory, setOrderHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [editingAddress, setEditingAddress] = useState(null)
  const [addressForm, setAddressForm] = useState({ label: '', address: '', notes: '', is_default: false })

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      const [profileRes, favRes, historyRes] = await Promise.all([
        api.getUserProfile(),
        api.getFavorites(),
        fetch('/api/history/' + encodeURIComponent(user.username)).then(r => r.json())
      ])
      
      if (profileRes.ok) {
        setAddresses(profileRes.user.addresses || [])
      }
      if (favRes.ok) {
        setFavorites(favRes.favorites || [])
      }
      setOrderHistory(historyRes || [])
    } catch (err) {
      console.error('Failed to load user data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddAddress = async () => {
    try {
      const res = await api.addAddress(addressForm)
      if (res.ok) {
        setShowAddressForm(false)
        setAddressForm({ label: '', address: '', notes: '', is_default: false })
        loadUserData()
      }
    } catch (err) {
      alert('Failed to add address')
    }
  }

  const handleDeleteAddress = async (id) => {
    try {
      const res = await api.deleteAddress(id)
      if (res.ok) loadUserData()
    } catch (err) {
      alert('Failed to delete address')
    }
  }

  const handleRemoveFavorite = async (id) => {
    try {
      const res = await api.removeFavorite(id)
      if (res.ok) loadUserData()
    } catch (err) {
      alert('Failed to remove favorite')
    }
  }

  const handleReorder = (hid) => {
    api.reorder(hid).then(res => {
      if (res.ok) {
        alert('Order added to cart! (This would integrate with current session)')
      }
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F3FF' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
        padding: '24px 20px 80px',
        color: '#FFF',
        position: 'relative'
      }}>
        <button onClick={onBack} style={{
          position: 'absolute',
          top: 20,
          left: 20,
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          borderRadius: 12,
          width: 36,
          height: 36,
          cursor: 'pointer',
          color: '#FFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <ArrowLeft size={20} />
        </button>

        <div style={{ textAlign: 'center', paddingTop: 20 }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: '#FFF',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
          }}>
            <User size={36} color={C.primary} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>{user?.username}</h1>
          <div style={{ fontSize: 14, opacity: 0.9 }}>
            {user?.phone && <span><Phone size={12} style={{ marginLeft: 4, verticalAlign: 'middle' }} />{user.phone}</span>}
            {user?.email && <span style={{ marginLeft: 12 }}><Mail size={12} style={{ marginLeft: 4, verticalAlign: 'middle' }} />{user.email}</span>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ 
        background: '#FFF', 
        borderRadius: '24px 24px 0 0', 
        marginTop: -40,
        minHeight: 500,
        padding: '20px 0',
        position: 'relative'
      }}>
        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '0 20px 20px',
          borderBottom: `1px solid ${C.border}`,
          marginBottom: 20
        }}>
          {[
            { id: 'history', label: 'Order History', icon: Clock },
            { id: 'addresses', label: 'Addresses', icon: MapPin },
            { id: 'favorites', label: 'Favorites', icon: Heart }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '12px 8px',
                border: 'none',
                borderRadius: 12,
                background: activeTab === tab.id ? C.primaryLight : 'transparent',
                color: activeTab === tab.id ? C.primary : C.muted,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '0 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Loading...</div>
          ) : (
            <>
              {activeTab === 'history' && (
                <OrderHistoryTab history={orderHistory} onReorder={handleReorder} />
              )}
              {activeTab === 'addresses' && (
                <AddressesTab 
                  addresses={addresses} 
                  onAdd={() => setShowAddressForm(true)}
                  onDelete={handleDeleteAddress}
                />
              )}
              {activeTab === 'favorites' && (
                <FavoritesTab favorites={favorites} onRemove={handleRemoveFavorite} />
              )}
            </>
          )}
        </div>{/* FIX: was </> — must close the <div style={{ padding: '0 20px' }}> */}
      </div>

      {/* Logout Button */}
      <div style={{ padding: '20px' }}>
        <Btn variant="secondary" onClick={logout} style={{ width: '100%', background: C.red, color: '#FFF' }}>
          <Shield size={18} style={{ marginLeft: 8 }} />
          Logout
        </Btn>
      </div>

      {/* Address Modal */}
      <Modal 
        title={editingAddress ? 'Edit Address' : 'Add Address'} 
        open={showAddressForm}
        onClose={() => { setShowAddressForm(false); setEditingAddress(null); setAddressForm({ label: '', address: '', notes: '', is_default: false }); }}
      >
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 6 }}>Label (Home, Work, etc.)</label>
            <input
              type="text"
              value={addressForm.label}
              onChange={e => setAddressForm(prev => ({ ...prev, label: e.target.value }))}
              placeholder="e.g., Home"
              style={{ width: '100%', padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14 }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 6 }}>Address</label>
            <textarea
              value={addressForm.address}
              onChange={e => setAddressForm(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Full delivery address"
              rows={3}
              style={{ width: '100%', padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, resize: 'vertical' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 6 }}>Notes (optional)</label>
            <input
              type="text"
              value={addressForm.notes}
              onChange={e => setAddressForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="e.g., Ring doorbell"
              style={{ width: '100%', padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14 }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={addressForm.is_default}
                onChange={e => setAddressForm(prev => ({ ...prev, is_default: e.target.checked }))}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 14, color: C.dark, fontWeight: 600 }}>Set as default address</span>
            </label>
          </div>
          <Btn onClick={handleAddAddress} style={{ width: '100%' }}>
            {editingAddress ? 'Update Address' : 'Add Address'}
          </Btn>
        </div>
      </Modal>
    </div>
  )
}

function OrderHistoryTab({ history, onReorder }) {
  if (history.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>
        <Clock size={48} style={{ marginBottom: 12, opacity: 0.5 }} />
        <p>No order history yet</p>
      </div>
    )
  }

  return (
    <div>
      {history.map((order, idx) => (
        <div key={idx} className="glass-card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: C.dark }}>{order.name}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {new Date(order.createdAt).toLocaleDateString('ar-EG')}
              </div>
            </div>
            <button
              onClick={() => onReorder(order.hid)}
              style={{
                background: C.primaryLight,
                border: 'none',
                borderRadius: 10,
                padding: '8px 12px',
                cursor: 'pointer',
                color: C.primary,
                fontWeight: 600,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Star size={14} /> Reorder
            </button>
          </div>
          <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.6 }}>
            {(order.lines || []).map((line, i) => (
              <div key={i}>• {line.iname} ×{line.qty}</div>
            ))}
            {Object.keys(order.drinks || {}).length > 0 && (
              <div style={{ marginTop: 4, color: C.primary }}>
                + {Object.values(order.drinks).reduce((a,b) => a+b, 0)} drinks
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function AddressesTab({ addresses, onAdd, onDelete }) {
  return (
    <div>
      {addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin size={48} />}
          title="No addresses saved"
          description="Add a delivery address for faster checkout"
          action={<Btn onClick={onAdd} size="small"><Plus size={16} style={{ marginLeft: 4 }} /> Add Address</Btn>}
        />
      ) : (
        <>
          {addresses.map(addr => (
            <div key={addr.id} className="glass-card" style={{ 
              marginBottom: 12, 
              padding: 16, 
              borderLeft: addr.is_default ? `4px solid ${C.primary}` : '4px solid transparent' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {addr.label && <span style={{ fontWeight: 800, color: C.dark }}>{addr.label}</span>}
                    {addr.is_default && (
                      <span style={{ 
                        background: C.primary, 
                        color: '#FFF', 
                        fontSize: 10, 
                        padding: '2px 8px', 
                        borderRadius: 6, 
                        fontWeight: 700 
                      }}>
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, color: C.dark, marginBottom: addr.notes ? 4 : 0 }}>
                    {addr.address}
                  </div>
                  {addr.notes && (
                    <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>
                      📝 {addr.notes}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onDelete(addr.id)}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: C.red, 
                    cursor: 'pointer',
                    padding: 4
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          <Btn onClick={onAdd} variant="secondary" style={{ width: '100%', marginTop: 8 }}>
            <Plus size={16} style={{ marginLeft: 4 }} /> Add New Address
          </Btn>
        </>
      )}
    </div>
  )
}

function FavoritesTab({ favorites, onRemove }) {
  if (favorites.length === 0) {
    return (
      <EmptyState
        icon={<Heart size={48} />}
        title="No favorites yet"
        description="Save your favorite orders and items for quick access"
        action={null}
      />
    )
  }

  return (
    <div>
      {favorites.map(fav => (
        <div key={fav.id} className="glass-card" style={{ marginBottom: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: C.dark, marginBottom: 4 }}>
                {fav.type === 'order' ? '📋 Saved Order' : '⭐ Favorite Item'}
              </div>
              <div style={{ fontSize: 14, color: C.dark }}>
                {JSON.stringify(fav.data).slice(0, 100)}...
              </div>
            </div>
            <button
              onClick={() => onRemove(fav.id)}
              style={{ 
                background: `${C.red}15`, 
                border: 'none', 
                borderRadius: 8, 
                padding: '6px 10px',
                cursor: 'pointer',
                color: C.red,
                fontSize: 12
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>
      <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>{icon}</div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 4 }}>{title}</h3>
      <p style={{ fontSize: 14, marginBottom: 16 }}>{description}</p>
      {action}
    </div>
  )
}
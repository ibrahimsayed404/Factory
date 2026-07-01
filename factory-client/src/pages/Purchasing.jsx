import React, { useState, useEffect } from 'react';
import { PageHeader, Table, Button, Card, Badge, Modal, Input, Label, Select, ErrorMsg } from '../components/ui';
import api from '../api';

export default function Purchasing() {
  const [activeTab, setActiveTab] = useState('orders'); // orders, requests, suppliers

  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'orders') {
        const res = await api.get('/purchasing/orders');
        setOrders(res.data);
      } else if (activeTab === 'requests') {
        const res = await api.get('/purchasing/requests');
        setRequests(res.data);
      } else if (activeTab === 'suppliers') {
        const res = await api.get('/purchasing/suppliers');
        setSuppliers(res.data);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'success';
      case 'received': return 'success';
      case 'ordered': return 'info';
      case 'partially_received': return 'warning';
      case 'draft': return 'default';
      default: return 'default';
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <PageHeader title="Purchasing" />

      {error && <ErrorMsg msg={error} />}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <Button variant={activeTab === 'orders' ? 'primary' : 'outline'} onClick={() => setActiveTab('orders')}>Purchase Orders</Button>
        <Button variant={activeTab === 'requests' ? 'primary' : 'outline'} onClick={() => setActiveTab('requests')}>Purchase Requests</Button>
        <Button variant={activeTab === 'suppliers' ? 'primary' : 'outline'} onClick={() => setActiveTab('suppliers')}>Suppliers</Button>
      </div>

      <Card>
        {activeTab === 'orders' && (
          <Table
            columns={[
              { key: 'order_number', label: 'Order #' },
              { key: 'supplier_name', label: 'Supplier' },
              { key: 'total_amount', label: 'Total', render: (val) => `$${Number(val).toFixed(2)}` },
              { key: 'status', label: 'Status', render: (val) => <Badge variant={getStatusColor(val)}>{val}</Badge> },
              { key: 'expected_delivery_date', label: 'Expected Delivery', render: (val) => new Date(val).toLocaleDateString() },
              { key: 'actions', label: 'Actions', render: (_, row) => (
                <div style={{ display: 'flex', gap: 5 }}>
                  <Button size="sm" variant="outline">View</Button>
                  {row.status === 'draft' && <Button size="sm" variant="success">Approve</Button>}
                  {row.status === 'ordered' && <Button size="sm" variant="primary">Receive</Button>}
                </div>
              )}
            ]}
            data={orders}
            loading={loading}
          />
        )}

        {activeTab === 'requests' && (
          <Table
            columns={[
              { key: 'request_number', label: 'Request #' },
              { key: 'requested_by_name', label: 'Requested By' },
              { key: 'total_estimated_amount', label: 'Est. Total', render: (val) => `$${Number(val).toFixed(2)}` },
              { key: 'status', label: 'Status', render: (val) => <Badge variant={getStatusColor(val)}>{val}</Badge> },
              { key: 'required_date', label: 'Required By', render: (val) => new Date(val).toLocaleDateString() },
              { key: 'actions', label: 'Actions', render: (_, row) => (
                <div style={{ display: 'flex', gap: 5 }}>
                  <Button size="sm" variant="outline">View</Button>
                  {row.status === 'draft' && <Button size="sm" variant="success">Approve</Button>}
                  {row.status === 'approved' && <Button size="sm" variant="primary">Create PO</Button>}
                </div>
              )}
            ]}
            data={requests}
            loading={loading}
          />
        )}

        {activeTab === 'suppliers' && (
          <Table
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'email', label: 'Email' },
              { key: 'phone', label: 'Phone' },
              { key: 'city', label: 'City' },
              { key: 'country', label: 'Country' },
              { key: 'actions', label: 'Actions', render: (_, row) => (
                <div style={{ display: 'flex', gap: 5 }}>
                  <Button size="sm" variant="outline">Ledger</Button>
                  <Button size="sm" variant="outline">Performance</Button>
                </div>
              )}
            ]}
            data={suppliers}
            loading={loading}
          />
        )}
      </Card>
    </div>
  );
}

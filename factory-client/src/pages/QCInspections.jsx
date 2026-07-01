import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { qcApi } from '../api';
import { toast } from 'react-toastify';
import { Table, Button, Badge, Modal, Form } from 'react-bootstrap';
import { FaPlus, FaEye } from 'react-icons/fa';

export default function QCInspections() {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    inspection_type: 'final',
    reference_type: 'production_order',
    reference_id: '',
    total_quantity: '',
    notes: '',
  });
  const navigate = useNavigate();

  const fetchInspections = async () => {
    try {
      const data = await qcApi.inspections();
      setInspections(data);
    } catch (err) {
      toast.error('Failed to load inspections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        reference_id: parseInt(formData.reference_id, 10),
        total_quantity: formData.total_quantity ? parseInt(formData.total_quantity, 10) : null,
      };
      await qcApi.createInspection(payload);
      toast.success('Inspection created successfully');
      setShowModal(false);
      fetchInspections();
    } catch (err) {
      toast.error(err.message || 'Failed to create inspection');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'passed': return <Badge bg="success">Passed</Badge>;
      case 'failed': return <Badge bg="danger">Failed</Badge>;
      case 'partial': return <Badge bg="warning" text="dark">Partial</Badge>;
      case 'rework': return <Badge bg="info">Rework</Badge>;
      default: return <Badge bg="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Quality Control Inspections</h2>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <FaPlus className="me-2" /> New Inspection
        </Button>
      </div>

      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Reference</th>
            <th>Inspector</th>
            <th>Total Qty</th>
            <th>Passed</th>
            <th>Failed</th>
            <th>Rework</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan="10" className="text-center">Loading...</td></tr>
          ) : inspections.length === 0 ? (
            <tr><td colSpan="10" className="text-center">No inspections found.</td></tr>
          ) : (
            inspections.map(ins => (
              <tr key={ins.id}>
                <td>#{ins.id}</td>
                <td className="text-capitalize">{ins.inspection_type.replace('_', ' ')}</td>
                <td className="text-capitalize">{ins.reference_type.replace('_', ' ')} #{ins.reference_id}</td>
                <td>{ins.inspector_name || 'N/A'}</td>
                <td>{ins.total_quantity}</td>
                <td className="text-success fw-bold">{ins.passed_quantity}</td>
                <td className="text-danger fw-bold">{ins.failed_quantity}</td>
                <td className="text-info fw-bold">{ins.rework_quantity}</td>
                <td>{getStatusBadge(ins.status)}</td>
                <td>
                  <Button variant="sm" className="btn-outline-primary" onClick={() => navigate(`/qc/inspections/${ins.id}`)}>
                    <FaEye /> View
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Form onSubmit={handleCreate}>
          <Modal.Header closeButton>
            <Modal.Title>New Inspection</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Inspection Type</Form.Label>
              <Form.Select 
                value={formData.inspection_type}
                onChange={e => setFormData({ ...formData, inspection_type: e.target.value })}
                required
              >
                <option value="incoming">Incoming (Purchase Order)</option>
                <option value="in_process">In-Process (Work Order)</option>
                <option value="final">Final (Production Order)</option>
              </Form.Select>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Reference Type</Form.Label>
              <Form.Select 
                value={formData.reference_type}
                onChange={e => setFormData({ ...formData, reference_type: e.target.value })}
                required
              >
                <option value="purchase_order">Purchase Order</option>
                <option value="work_order">Work Order</option>
                <option value="production_order">Production Order</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Reference ID</Form.Label>
              <Form.Control 
                type="number" 
                value={formData.reference_id}
                onChange={e => setFormData({ ...formData, reference_id: e.target.value })}
                required 
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Total Quantity (Leave blank to auto-detect)</Form.Label>
              <Form.Control 
                type="number" 
                value={formData.total_quantity}
                onChange={e => setFormData({ ...formData, total_quantity: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Notes</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={2}
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Create Inspection</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}

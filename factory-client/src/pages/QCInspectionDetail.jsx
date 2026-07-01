import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { qcApi } from '../api';
import { toast } from 'react-toastify';
import { Card, Form, Button, Row, Col, Table, Badge } from 'react-bootstrap';

export default function QCInspectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Results form state
  const [passedQty, setPassedQty] = useState('');
  const [failedQty, setFailedQty] = useState('');
  const [reworkQty, setReworkQty] = useState('');
  const [notes, setNotes] = useState('');
  const [defects, setDefects] = useState([]);
  
  const fileInputRef = useRef(null);

  const fetchData = async () => {
    try {
      const [insData, catData] = await Promise.all([
        qcApi.getInspection(id),
        qcApi.defectCategories()
      ]);
      setInspection(insData);
      setCategories(catData);
      setPassedQty(insData.passed_quantity || 0);
      setFailedQty(insData.failed_quantity || 0);
      setReworkQty(insData.rework_quantity || 0);
      setNotes(insData.notes || '');
    } catch (err) {
      toast.error('Failed to load inspection details');
      navigate('/qc/inspections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAddDefect = () => {
    setDefects([...defects, { defect_category_id: categories[0]?.id || '', quantity: 1, notes: '' }]);
  };

  const updateDefect = (index, field, value) => {
    const newDefects = [...defects];
    newDefects[index][field] = value;
    setDefects(newDefects);
  };

  const removeDefect = (index) => {
    const newDefects = defects.filter((_, i) => i !== index);
    setDefects(newDefects);
  };

  const handleSubmitResults = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        passed_quantity: parseInt(passedQty, 10),
        failed_quantity: parseInt(failedQty, 10),
        rework_quantity: parseInt(reworkQty, 10),
        notes,
        defects: defects.map(d => ({
          ...d,
          defect_category_id: parseInt(d.defect_category_id, 10),
          quantity: parseInt(d.quantity, 10)
        }))
      };
      
      const total = payload.passed_quantity + payload.failed_quantity + payload.rework_quantity;
      if (total !== inspection.total_quantity) {
        toast.error(`Total quantities (${total}) must equal inspection total (${inspection.total_quantity})`);
        return;
      }

      await qcApi.updateResults(id, payload);
      toast.success('Inspection results updated');
      fetchData();
      setDefects([]); // Clear unsubmitted defects on success
    } catch (err) {
      toast.error(err.message || 'Failed to update results');
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    try {
      await qcApi.uploadPhoto(id, formData);
      toast.success('Photo uploaded successfully');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to upload photo');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!inspection) return <div className="p-4">Inspection not found</div>;

  return (
    <div className="p-4">
      <Button variant="link" onClick={() => navigate('/qc/inspections')} className="mb-3">
        &larr; Back to Inspections
      </Button>

      <Row>
        <Col md={4}>
          <Card className="mb-4">
            <Card.Header><h5>Inspection Details</h5></Card.Header>
            <Card.Body>
              <p><strong>ID:</strong> #{inspection.id}</p>
              <p><strong>Type:</strong> <span className="text-capitalize">{inspection.inspection_type.replace('_', ' ')}</span></p>
              <p><strong>Reference:</strong> <span className="text-capitalize">{inspection.reference_type.replace('_', ' ')}</span> #{inspection.reference_id}</p>
              <p><strong>Status:</strong> <Badge bg={inspection.status === 'passed' ? 'success' : inspection.status === 'failed' ? 'danger' : 'secondary'}>{inspection.status}</Badge></p>
              <p><strong>Total Quantity:</strong> {inspection.total_quantity}</p>
              <p><strong>Inspector:</strong> {inspection.inspector_name}</p>
              <p><strong>Created At:</strong> {new Date(inspection.created_at).toLocaleString()}</p>
              {inspection.notes && <p><strong>Initial Notes:</strong> {inspection.notes}</p>}
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header>
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Photos Evidence</h5>
                <Button variant="outline-primary" size="sm" onClick={() => fileInputRef.current.click()}>Upload Photo</Button>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handlePhotoUpload} />
              </div>
            </Card.Header>
            <Card.Body>
              {inspection.photos?.length === 0 ? (
                <p className="text-muted">No photos uploaded.</p>
              ) : (
                <div className="d-flex flex-wrap gap-2">
                  {inspection.photos?.map(photo => (
                    <div key={photo.id} className="border p-1" style={{ width: '120px' }}>
                      <a href={`${import.meta.env.VITE_API_URL?.replace('/api', '') || ''}/uploads/qc-photos/${photo.file_path}`} target="_blank" rel="noreferrer">
                        <img 
                          src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || ''}/uploads/qc-photos/${photo.file_path}`} 
                          alt="Evidence" 
                          style={{ width: '100%', height: '100px', objectFit: 'cover' }}
                        />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={8}>
          <Card className="mb-4">
            <Card.Header><h5>Record Results</h5></Card.Header>
            <Card.Body>
              <Form onSubmit={handleSubmitResults}>
                <Row className="mb-3">
                  <Col>
                    <Form.Label>Passed Quantity</Form.Label>
                    <Form.Control type="number" min="0" required value={passedQty} onChange={e => setPassedQty(e.target.value)} />
                  </Col>
                  <Col>
                    <Form.Label>Failed Quantity</Form.Label>
                    <Form.Control type="number" min="0" required value={failedQty} onChange={e => setFailedQty(e.target.value)} />
                  </Col>
                  <Col>
                    <Form.Label>Rework Quantity</Form.Label>
                    <Form.Control type="number" min="0" required value={reworkQty} onChange={e => setReworkQty(e.target.value)} />
                  </Col>
                </Row>
                
                <Form.Group className="mb-4">
                  <Form.Label>Inspector Notes</Form.Label>
                  <Form.Control as="textarea" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
                </Form.Group>

                {inspection.defects?.length > 0 && (
                  <div className="mb-4">
                    <h6>Logged Defects</h6>
                    <Table size="sm" bordered>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Qty</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inspection.defects.map(d => (
                          <tr key={d.id}>
                            <td>{d.category_name}</td>
                            <td>{d.quantity}</td>
                            <td>{d.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}

                <div className="mb-3 d-flex justify-content-between align-items-center">
                  <h6>New Defects</h6>
                  <Button variant="outline-danger" size="sm" onClick={handleAddDefect}>+ Add Defect</Button>
                </div>
                
                {defects.map((defect, idx) => (
                  <Row key={idx} className="mb-2 align-items-end border p-2 bg-light">
                    <Col md={4}>
                      <Form.Label>Category</Form.Label>
                      <Form.Select 
                        value={defect.defect_category_id} 
                        onChange={e => updateDefect(idx, 'defect_category_id', e.target.value)}
                        required
                      >
                        <option value="">Select...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </Form.Select>
                    </Col>
                    <Col md={2}>
                      <Form.Label>Qty</Form.Label>
                      <Form.Control type="number" min="1" required value={defect.quantity} onChange={e => updateDefect(idx, 'quantity', e.target.value)} />
                    </Col>
                    <Col md={5}>
                      <Form.Label>Notes</Form.Label>
                      <Form.Control type="text" value={defect.notes} onChange={e => updateDefect(idx, 'notes', e.target.value)} />
                    </Col>
                    <Col md={1}>
                      <Button variant="danger" size="sm" onClick={() => removeDefect(idx)}>X</Button>
                    </Col>
                  </Row>
                ))}

                <div className="text-end mt-4">
                  <Button variant="primary" type="submit">Save Results</Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

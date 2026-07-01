import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table } from 'react-bootstrap';
import { qcApi } from '../api';
import { toast } from 'react-toastify';

export default function QCReports() {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const data = await qcApi.reports();
        setReports(data);
      } catch (err) {
        toast.error('Failed to load QC reports');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  if (loading) return <div className="p-4">Loading reports...</div>;
  if (!reports) return <div className="p-4">No report data available</div>;

  const { summary, top_defects } = reports;
  const yieldRate = summary.total_inspected_qty > 0 
    ? ((summary.total_passed_qty / summary.total_inspected_qty) * 100).toFixed(2)
    : 0;

  return (
    <div className="p-4">
      <h2 className="mb-4">Quality Control Reports</h2>

      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center shadow-sm">
            <Card.Body>
              <h6 className="text-muted text-uppercase mb-2">Total Inspections</h6>
              <h3 className="mb-0">{summary.total_inspections}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center shadow-sm bg-success text-white">
            <Card.Body>
              <h6 className="text-uppercase mb-2">Total Passed Qty</h6>
              <h3 className="mb-0">{summary.total_passed_qty || 0}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center shadow-sm bg-danger text-white">
            <Card.Body>
              <h6 className="text-uppercase mb-2">Total Failed Qty</h6>
              <h3 className="mb-0">{summary.total_failed_qty || 0}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center shadow-sm bg-primary text-white">
            <Card.Body>
              <h6 className="text-uppercase mb-2">Yield Rate</h6>
              <h3 className="mb-0">{yieldRate}%</h3>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col md={6}>
          <Card className="shadow-sm">
            <Card.Header>
              <h5 className="mb-0">Top Defect Categories</h5>
            </Card.Header>
            <Card.Body>
              {top_defects.length === 0 ? (
                <p className="text-muted">No defects logged yet.</p>
              ) : (
                <Table striped hover size="sm">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th className="text-end">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top_defects.map((def, idx) => (
                      <tr key={idx}>
                        <td>{def.category}</td>
                        <td className="text-end text-danger fw-bold">{def.total_quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

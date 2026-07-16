import React, { useMemo, useState } from 'react';

import { productApi, productionTrackingApi } from '../api';

import { useFetch } from '../hooks/useFetch';

import { PageHeader, Card, Table, Badge, Btn, Modal, Input, Spinner, ErrorMsg, statusVariant, SearchInput } from '../components/ui';

import { useLanguage } from '../context/LanguageContext';

import { useAuth } from '../context/AuthContext';

import { buildProductNameLookup, getOrderDisplayNumber, getOrderProductName } from '../utils/productionOrderDisplay';

import { buildExitPermissionPayload, orderHasSortingPhase, printExitPermission } from '../utils/exitPermissionPrint';



const statusLabel = {

  pending: 'Pending',

  sorting: 'Sorting',

  outsourcing: 'Outsourcing',

  completed: 'Completed',

  in_progress: 'In Progress',

  done: 'Done',

  shipped: 'Shipped',

};



const findSortingPhase = (report) => {

  const phases = report?.phases || [];

  for (let i = phases.length - 1; i >= 0; i -= 1) {

    if (phases[i].phase === 'sorting') return phases[i];

  }

  return null;

};



export default function ProductionOrderManage() {

  const { t, language } = useLanguage();

  const { user } = useAuth();

  const { data: orders, loading, error, refetch } = useFetch(productionTrackingApi.list);

  const { data: products } = useFetch(productApi.list);

  const [statusFilter, setStatusFilter] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);

  const [password, setPassword] = useState('');

  const [deleteError, setDeleteError] = useState('');

  const [deleting, setDeleting] = useState(false);

  const [printingId, setPrintingId] = useState(null);

  const [printError, setPrintError] = useState('');

  const [success, setSuccess] = useState('');

  const [searchTerm, setSearchTerm] = useState('');



  const productNameById = useMemo(() => buildProductNameLookup(products), [products]);



  const displayed = useMemo(() => {
    let list = orders || [];
    
    // Apply status filter
    if (statusFilter) {
      list = list.filter((o) => o.status === statusFilter);
    }
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(order => 
        (order.order_number?.toLowerCase() || '').includes(term) ||
        (order.product_name?.toLowerCase() || '').includes(term) ||
        (order.status?.toLowerCase() || '').includes(term) ||
        (order.model_number?.toLowerCase() || '').includes(term)
      );
    }
    
    return list;
  }, [orders, statusFilter, searchTerm]);



  const openDelete = (order) => {

    setDeleteTarget(order);

    setPassword('');

    setDeleteError('');

    setSuccess('');

    setPrintError('');

  };



  const closeDelete = () => {

    if (deleting) return;

    setDeleteTarget(null);

    setPassword('');

    setDeleteError('');

  };



  const handlePrintExitPermission = async (order) => {

    setPrintError('');

    setPrintingId(order.id);

    try {

      const report = await productionTrackingApi.getReport(order.id);

      const sortingPhase = findSortingPhase(report);

      const payload = buildExitPermissionPayload(

        order,

        sortingPhase || { quantity: order.phases?.sorting ?? report.sorting, color_breakdown: [] },

        sortingPhase?.employee || '',

        sortingPhase?.completed_at || order.created_at,

        productNameById

      );

      printExitPermission({ ...payload, language });

    } catch (e) {

      setPrintError(e.message || t('printFailed', 'Failed to print exit permission.'));

    } finally {

      setPrintingId(null);

    }

  };



  const handleDelete = async () => {

    if (!deleteTarget) return;

    if (!password.trim()) {

      setDeleteError(t('passwordRequired', 'Password is required.'));

      return;

    }



    setDeleting(true);

    setDeleteError('');

    try {

      await productionTrackingApi.deleteOrder(deleteTarget.id, { password });

      setSuccess(t('orderDeleted', 'Order cancelled and deleted successfully.'));

      setDeleteTarget(null);

      setPassword('');

      await refetch();

    } catch (e) {

      setDeleteError(e.message || t('deleteFailed', 'Failed to delete order.'));

    } finally {

      setDeleting(false);

    }

  };



  const columns = [

    {

      key: 'order_number',

      label: t('orderNumber', 'Order #'),

      render: (_, row) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{getOrderDisplayNumber(row)}</span>,

    },

    {

      key: 'model_number',

      label: t('productNumber', 'Product Number'),

      render: (_, row) => getOrderDisplayNumber(row),

    },

    {

      key: 'product_name',

      label: t('productName', 'Product Name'),

      render: (_, row) => getOrderProductName(row, productNameById),

    },

    {

      key: 'planned_quantity',

      label: t('qty', 'Qty'),

      render: (v, row) => row.phases?.input ?? v ?? '—',

    },

    {

      key: 'status',

      label: t('status', 'Status'),

      render: (v) => <Badge variant={statusVariant(v)}>{statusLabel[v] || v}</Badge>,

    },

    {

      key: 'created_at',

      label: t('date', 'Date'),

      render: (v) => (v ? new Date(v).toLocaleDateString() : '—'),

    },

    {

      key: 'actions',

      label: '',

      render: (_, row) => (

        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>

          {orderHasSortingPhase(row) && (

            <Btn

              size="sm"

              onClick={() => handlePrintExitPermission(row)}

              disabled={printingId === row.id}

            >

              {printingId === row.id ? t('printing', 'Printing…') : t('printExitPermission', 'Exit Permission')}

            </Btn>

          )}

          <Btn size="sm" variant="danger" onClick={() => openDelete(row)}>

            {t('cancelOrder', 'Cancel / Delete')}

          </Btn>

        </div>

      ),

    },

  ];



  return (

    <div style={{ padding: '28px 28px 40px' }}>

      <PageHeader

        title={t('manageOrders', 'Manage Production Orders')}

        subtitle={t('manageOrdersSubtitle', 'View orders, print exit permission after sorting, or cancel with password')}

        action={(

          <select

            value={statusFilter}

            onChange={(e) => setStatusFilter(e.target.value)}

            style={{

              background: 'var(--bg-elevated)',

              border: '1px solid var(--border)',

              borderRadius: 'var(--radius-sm)',

              color: 'var(--text-primary)',

              padding: '8px 12px',

              fontSize: 13,

            }}

          >

            <option value="">{t('allStatuses', 'All statuses')}</option>

            <option value="pending">{t('pending', 'Pending')}</option>

            <option value="sorting">{t('sorting', 'Sorting')}</option>

            <option value="outsourcing">{t('outsourcing', 'Outsourcing')}</option>

            <option value="completed">{t('completed', 'Completed')}</option>

          </select>

        )}

      />



      {loading && <Spinner />}

      {error && <ErrorMsg msg={error} />}

      {printError && <div style={{ marginBottom: 12 }}><ErrorMsg msg={printError} /></div>}

      {!loading && (
        <>
          <Card padding="12px 16px" style={{ marginBottom: 16 }}>
            <SearchInput 
              placeholder="Search by order number, product name, status, or model number..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </Card>
          <Card padding="0"><Table columns={columns} data={displayed} /></Card>
        </>
      )}

      {success && <div style={{ marginBottom: 12, color: 'var(--accent)', fontSize: 13 }}>{success}</div>}

      {deleteTarget && (

        <Modal title={t('cancelOrderTitle', 'Cancel Production Order?')} onClose={closeDelete} width={440}>

          <div style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>

            {t('cancelOrderWarning', 'This will permanently delete the order and restore deducted materials. Finished product stock will be reversed if applicable.')}

          </div>

          <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--text-secondary)' }}>

            <strong>{getOrderDisplayNumber(deleteTarget)}</strong>

            <div>{getOrderProductName(deleteTarget, productNameById)}</div>

          </div>

          <Input

            label={t('confirmPassword', 'Enter your password to confirm')}

            type="password"

            value={password}

            onChange={(e) => {

              setPassword(e.target.value);

              if (deleteError) setDeleteError('');

            }}

            placeholder={user?.email || ''}

            autoComplete="current-password"

          />

          {deleteError && <div style={{ marginTop: 12 }}><ErrorMsg msg={deleteError} /></div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>

            <Btn onClick={closeDelete} disabled={deleting}>{t('cancel', 'Cancel')}</Btn>

            <Btn variant="danger" onClick={handleDelete} disabled={deleting}>

              {deleting ? t('deleting', 'Deleting...') : t('delete', 'Delete')}

            </Btn>

          </div>

        </Modal>

      )}

    </div>

  );

}



/* eslint-disable react/prop-types */
import React from 'react';
import { Btn } from '../ui';
import BlackFoxLogo from '../brand/BlackFoxLogo';

const formatColorName = (val) => {
  if (!val) return '—';
  // Insert clean separator between Arabic and Latin scripts if squished: e.g. أسودKahli -> أسود / Kahli
  return String(val)
    .replace(/([\u0600-\u06FF])([a-zA-Z])/g, '$1 / $2')
    .replace(/([a-zA-Z])([\u0600-\u06FF])/g, '$1 / $2')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
};

export const PrintableOrderSlip = ({ order, type = 'cutting', printShop, customer, onClose }) => {
  if (!order) return null;

  const titles = {
    cutting: { main: 'إذن تشغيل وأمر قص', sub: 'أمر تشغيل خط القص والتفصيل المعتمد', badge: 'مرحلة 1: القص' },
    sorting: { main: 'تقرير وإذن فرز ما بعد القص', sub: 'مطابقة الفحص المبدئي والفرز للجودة', badge: 'مرحلة 2: الفرز' },
    print_send: { main: 'أمر توريد وإذن خروج للمطبعة', sub: 'إذن صرف وتسليم لمطبعة الشريك الخارجي', badge: 'مرحلة 3: إرسال للمطبعة' },
    print_receive: { main: 'إذن استلام وفحص من المطبعة', sub: 'محضر استلام وفحص جودة الطباعة', badge: 'مرحلة 3: استلام المطبعة' },
    delivery: { main: 'إذن تسليم وفاتورة للعميل', sub: 'محضر تسليم بضاعة جاهزة للعميل النهائي', badge: 'مرحلة 4: تسليم العميل' },
  };

  const currentMeta = titles[type] || { main: 'إذن تشغيل', sub: 'وثيقة رسمية لإدارة العمليات والإنتاج', badge: 'إذن تشغيل' };
  const colors = order.colors || [];
  const currentDate = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const docNumber = `BF-${order.model_number || order.order_number || order.id}-${type.toUpperCase().slice(0, 4)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16,
    }}>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 10mm 12mm;
          }
          body * {
            visibility: hidden;
          }
          .printable-slip-modal, .printable-slip-modal * {
            visibility: visible;
          }
          .printable-slip-modal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        className="printable-slip-modal"
        style={{
          background: '#ffffff',
          color: '#0f172a',
          width: '100%',
          maxWidth: 820,
          maxHeight: '94vh',
          overflowY: 'auto',
          borderRadius: 12,
          padding: '28px 36px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          border: '1px solid #cbd5e1',
          direction: 'rtl',
          fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
          position: 'relative',
        }}
      >
        {/* Top Actions Bar (hidden when printing) */}
        <div className="no-print" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          paddingBottom: 14,
          borderBottom: '1px solid #e2e8f0',
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Btn variant="primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', fontWeight: 700 }}>
              <span style={{ fontSize: 16 }}>🖨️</span> طباعة المستند (Print / PDF)
            </Btn>
            <Btn variant="secondary" onClick={onClose} style={{ padding: '9px 18px' }}>
              إغلاق
            </Btn>
          </div>
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
            معاينة رسمية لمستند الطباعة و PDF
          </span>
        </div>

        {/* ═══ Official Executive Header ═══ */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 18,
          borderBottom: '3px solid #1e293b',
          marginBottom: 18,
        }}>
          {/* Brand & Factory Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <BlackFoxLogo compact style={{ padding: 0 }} />
            <div style={{ borderRight: '2px solid #e2e8f0', paddingRight: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.01em' }}>
                مصنع بلاك فوكس للملابس الجاهزة
              </div>
              <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginTop: 2 }}>
                إدارة العمليات والجودة والإنتاج الصناعي
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                Black Fox Clothing Factory — Production & QC Operations
              </div>
            </div>
          </div>

          {/* Document Type Badge & Serial */}
          <div style={{ textAlign: 'left', minWidth: 200 }}>
            <div style={{
              display: 'inline-block',
              background: '#1e293b',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: 6,
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.02em',
              marginBottom: 6,
            }}>
              {currentMeta.main}
            </div>
            <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 700, letterSpacing: '0.05em', fontFamily: 'monospace' }}>
              DOC REF: {docNumber}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {currentDate}
            </div>
          </div>
        </div>

        {/* Subtitle / Document Description Banner */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f1f5f9',
          padding: '8px 14px',
          borderRadius: 6,
          marginBottom: 18,
          borderRight: '4px solid #2563eb',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
            {currentMeta.sub}
          </div>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            background: '#e0e7ff',
            color: '#1d4ed8',
            padding: '2px 8px',
            borderRadius: 4,
          }}>
            {currentMeta.badge}
          </span>
        </div>

        {/* ═══ 4-Column Essential Metadata Grid ═══ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}>
          {/* Tile 1: Order/Model */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            padding: '10px 12px',
            borderTop: '3px solid #2563eb',
          }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>رقم الموديل / الأوردر</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#1e40af', marginTop: 3 }}>
              {order.model_number || order.order_number}
            </div>
          </div>

          {/* Tile 2: Style Name */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            padding: '10px 12px',
            borderTop: '3px solid #0f172a',
          }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>اسم الموديل / الصنف</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={order.order_name || order.product_name}>
              {order.order_name || order.product_name || '—'}
            </div>
          </div>

          {/* Tile 3: Partner / Destination */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            padding: '10px 12px',
            borderTop: '3px solid #0284c7',
          }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>
              {type === 'delivery' ? 'العميل المستلم' : (type === 'print_send' || type === 'print_receive' ? 'المطبعة الخارجية' : 'جهة التشغيل')}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0369a1', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {type === 'delivery'
                ? (order.customer_name || customer?.name || 'عميل عام')
                : (order.print_shop_name || printShop?.name || 'الورشة الداخلية')}
            </div>
          </div>

          {/* Tile 4: Total Quantity */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            padding: '10px 12px',
            borderTop: '3px solid #16a34a',
          }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>إجمالي الكمية المقررة</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#15803d', marginTop: 3 }}>
              {(order.total_cut_quantity || colors.reduce((s, c) => s + Number(c.cut_quantity || 0), 0)).toLocaleString()} <span style={{ fontSize: 11, fontWeight: 600 }}>قطعة</span>
            </div>
          </div>
        </div>

        {/* ═══ Quantities & Colors Breakdown Table ═══ */}
        <div style={{ marginBottom: 20 }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
            border: '1px solid #cbd5e1',
          }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                <th style={{ padding: '9px 10px', textAlign: 'center', width: 36, borderBottom: '2px solid #334155' }}>#</th>
                <th style={{ padding: '9px 14px', textAlign: 'right', borderBottom: '2px solid #334155' }}>اللون / الصنف</th>
                <th style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '2px solid #334155' }}>كمية القص</th>
                {type !== 'cutting' && (
                  <th style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '2px solid #334155' }}>كمية الفرز</th>
                )}
                {(type === 'print_send' || type === 'print_receive') && (
                  <th style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '2px solid #334155' }}>
                    {type === 'print_send' ? 'الكمية المرسلة' : 'الكمية المستلمة'}
                  </th>
                )}
                {type === 'delivery' && (
                  <>
                    <th style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '2px solid #334155' }}>المسلم فعلياً</th>
                    <th style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '2px solid #334155' }}>سعر القطعة</th>
                    <th style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '2px solid #334155' }}>الإجمالي</th>
                  </>
                )}
                <th style={{ padding: '9px 14px', textAlign: 'right', borderBottom: '2px solid #334155' }}>ملاحظات الجودة والتشغيل</th>
              </tr>
            </thead>
            <tbody>
              {colors.map((c, idx) => {
                const deliveredQty = c.delivered_quantity || c.print_received_quantity || c.sorted_quantity || c.cut_quantity;
                const unitPrice = order.unit_price || 0;
                const lineTotal = deliveredQty * unitPrice;
                const formattedColor = formatColorName(c.color);

                return (
                  <tr key={c.id || idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '8px 10px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '8px 14px', border: '1px solid #e2e8f0' }}>
                      <span style={{
                        display: 'inline-block',
                        fontWeight: 800,
                        color: '#0f172a',
                        fontSize: 13,
                      }}>
                        {formattedColor}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 700 }}>
                      {Number(c.cut_quantity || 0).toLocaleString()}
                    </td>
                    {type !== 'cutting' && (
                      <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 700, color: c.sorted_quantity !== null ? '#0f172a' : '#94a3b8' }}>
                        {c.sorted_quantity !== null ? Number(c.sorted_quantity).toLocaleString() : '—'}
                      </td>
                    )}
                    {(type === 'print_send' || type === 'print_receive') && (
                      <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 800, color: '#1d4ed8' }}>
                        {type === 'print_send'
                          ? Number(c.print_sent_quantity ?? c.sorted_quantity ?? c.cut_quantity ?? 0).toLocaleString()
                          : (c.print_received_quantity !== null ? Number(c.print_received_quantity).toLocaleString() : '—')}
                      </td>
                    )}
                    {type === 'delivery' && (
                      <>
                        <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 800, color: '#1d4ed8' }}>
                          {Number(deliveredQty || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600 }}>
                          {unitPrice ? `${Number(unitPrice).toLocaleString()} ج.م` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 800, color: '#15803d' }}>
                          {lineTotal ? `${Number(lineTotal).toLocaleString()} ج.م` : '—'}
                        </td>
                      </>
                    )}
                    <td style={{ padding: '8px 14px', border: '1px solid #e2e8f0', color: '#475569', fontSize: 11 }}>
                      {c.sorting_note || c.print_note || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f1f5f9', fontWeight: 900, borderTop: '2px solid #cbd5e1' }}>
                <td colSpan="2" style={{ padding: '10px 14px', textAlign: 'right', border: '1px solid #cbd5e1', fontSize: 13, color: '#0f172a' }}>
                  الإجمالي العام للمستند
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 13 }}>
                  {(order.total_cut_quantity || colors.reduce((s, c) => s + Number(c.cut_quantity || 0), 0)).toLocaleString()} <span style={{ fontSize: 11, fontWeight: 600 }}>ق</span>
                </td>
                {type !== 'cutting' && (
                  <td style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 13 }}>
                    {order.total_sorted_quantity !== null && order.total_sorted_quantity !== undefined ? `${Number(order.total_sorted_quantity).toLocaleString()} ق` : '—'}
                  </td>
                )}
                {(type === 'print_send' || type === 'print_receive') && (
                  <td style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #cbd5e1', color: '#1d4ed8', fontSize: 13 }}>
                    {type === 'print_send'
                      ? `${Number(order.total_print_sent_quantity || 0).toLocaleString()} ق`
                      : (order.total_print_received_quantity !== null && order.total_print_received_quantity !== undefined ? `${Number(order.total_print_received_quantity).toLocaleString()} ق` : '—')}
                  </td>
                )}
                {type === 'delivery' && (
                  <>
                    <td style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #cbd5e1', color: '#1d4ed8', fontSize: 13 }}>
                      {(order.total_delivered_quantity || colors.reduce((s, c) => s + Number(c.delivered_quantity || c.cut_quantity || 0), 0)).toLocaleString()} ق
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #cbd5e1' }}>—</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', border: '1px solid #cbd5e1', color: '#15803d', fontSize: 14 }}>
                      {order.total_price ? `${Number(order.total_price).toLocaleString()} ج.م` : '—'}
                    </td>
                  </>
                )}
                <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1' }}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ═══ Standard Quality Operating Procedure (SOP) & Stage Guidance ═══ */}
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRight: '4px solid #16a34a',
          padding: '10px 14px',
          borderRadius: 6,
          marginBottom: 20,
          fontSize: 11.5,
          color: '#166534',
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🔍</span> معايير الجودة والتشغيل القياسية للمرحلة ({currentMeta.main}):
          </div>
          <ul style={{ margin: 0, paddingRight: 18 }}>
            {type === 'cutting' && (
              <>
                <li><strong>مقصدار القماش:</strong> التأكد من اتجاه نسيج القماش وتطابق طبقات الفرش مع الباترون القياسي المعتمد.</li>
                <li><strong>نسبة السماح:</strong> أقصى نسبة تفاوت مسموح بها في الأبعاد هي ±0.5 سم، وممنوع تجاوز نسبة هالك 1.5% من إجمالي الثوب.</li>
                <li><strong>التثبيت والترقيم:</strong> إلزامية وضع كروت البندل الملونة على كل رصة لمنع اختلاط الدرجات اللونية (Shading).</li>
              </>
            )}
            {type === 'sorting' && (
              <>
                <li><strong>الفحص المبدئي:</strong> فحص سلامة أجزاء كل قطعة (الصدر، الظهر، الأكمام، الياقة) قبل التوجيه للخط التالي.</li>
                <li><strong>عزل العيوب:</strong> استبعاد أي قطعة بها عيوب نسيج، بقع زيت، أو قطع فوراً وتدوينها في خانة العجز التالف.</li>
                <li><strong>العد النهائي:</strong> مطابقة العدد الفعلي المفرز مع أمر القص والتوقيع قبل التحويل للمطبعة أو التغليف.</li>
              </>
            )}
            {(type === 'print_send' || type === 'print_receive') && (
              <>
                <li><strong>مطابقة العينة المعتمدة (Master Swatch):</strong> مطابقة أبعاد وألوان الطباعة أو التطريز مع العينة المختومة من الإدارة.</li>
                <li><strong>اختبار الثبات والمتانة:</strong> التأكد من جفاف الأحبار تماماً واختبار مقاومة الغسيل والشد قبل قبول الدفعة.</li>
                <li><strong>نسبة الفاقد المسموح:</strong> أقصى نسبة عجز مقبولة للمطبعة 2%؛ ما زاد عن ذلك يُخصم من مستحقات المطبعة.</li>
              </>
            )}
            {type === 'delivery' && (
              <>
                <li><strong>التشطيب والتغليف:</strong> مراجعة نظافة القطع والكي والتغليف بالباركود المعتمد لكيس الشحن.</li>
                <li><strong>الفحص النهائي:</strong> مطابقة الكميات الفعلية مع إذن الصرف وفاتورة العميل والتوقيع بالاستلام.</li>
              </>
            )}
          </ul>
        </div>

        {/* ═══ Official Signatures & Verification Seal ═══ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          paddingTop: 18,
          borderTop: '2px dashed #cbd5e1',
          marginTop: 20,
          textAlign: 'center',
          fontSize: 12,
        }}>
          {/* Signature 1 */}
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 14px',
            background: '#f8fafc',
          }}>
            <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 35 }}>
              توقيع مسؤول المرحلة
            </div>
            <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: 6, color: '#475569', fontSize: 11 }}>
              الاسم: .......................................
            </div>
          </div>

          {/* Signature 2 */}
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 14px',
            background: '#f8fafc',
          }}>
            <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 35 }}>
              توقيع المستلم / المندوب
            </div>
            <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: 6, color: '#475569', fontSize: 11 }}>
              الاسم: .......................................
            </div>
          </div>

          {/* Signature 3 + Official Stamp */}
          <div style={{
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            padding: '10px 12px',
            background: '#ffffff',
            position: 'relative',
          }}>
            <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
              اعتماد إدارة المصنع
            </div>
            {/* Stylized Factory Seal Watermark */}
            <div style={{
              display: 'inline-block',
              border: '2px solid #2563eb',
              borderRadius: '50%',
              padding: '6px 12px',
              color: '#2563eb',
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              margin: '4px auto 6px',
              opacity: 0.85,
              transform: 'rotate(-4deg)',
            }}>
              BLACK FOX APPROVED
            </div>
            <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: 4, color: '#475569', fontSize: 11 }}>
              الختم والتاريخ المعتمد
            </div>
          </div>
        </div>

        {/* Document Footer Note */}
        <div style={{
          marginTop: 20,
          textAlign: 'center',
          fontSize: 10,
          color: '#94a3b8',
          borderTop: '1px solid #f1f5f9',
          paddingTop: 8,
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>Black Fox Clothing Factory Management System</span>
          <span>صفحة 1 من 1 — وثيقة رسمية معتمدة لا يعتد بها بدون التوقيعات</span>
        </div>
      </div>
    </div>
  );
};

export default PrintableOrderSlip;

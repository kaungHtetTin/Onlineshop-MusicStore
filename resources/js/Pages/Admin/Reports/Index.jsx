import { useMemo } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';

const money = (value) =>
    `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (value) => `${Number(value || 0).toFixed(1)}%`;

function MetricCard({ label, value, hint, icon, tone }) {
    return (
        <article className={`metric-card glass ${tone ? `tone-${tone}` : ''}`}>
            <span className="icon-well">
                <Icon name={icon} size={15} />
            </span>
            <small>{label}</small>
            <strong>{value}</strong>
            {hint && <p>{hint}</p>}
        </article>
    );
}

function SalesTrendChart({ rows }) {
    const chart = useMemo(() => {
        const data = rows.map((row) => ({
            day: row.day,
            orders: Number(row.orders || 0),
            revenue: Number(row.revenue || 0),
        }));

        if (data.length === 0) return null;

        const width = 760;
        const height = 260;
        const padding = { top: 18, right: 18, bottom: 34, left: 64 };
        const innerWidth = width - padding.left - padding.right;
        const innerHeight = height - padding.top - padding.bottom;
        const maxRevenue = Math.max(...data.map((row) => row.revenue), 1);
        const maxOrders = Math.max(...data.map((row) => row.orders), 1);
        const xFor = (index) => padding.left + (data.length === 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);
        const yRevenue = (value) => padding.top + ((maxRevenue - value) / maxRevenue) * innerHeight;
        const yOrders = (value) => padding.top + ((maxOrders - value) / maxOrders) * innerHeight;
        const revenueLine = data.map((row, index) => `${xFor(index)},${yRevenue(row.revenue)}`).join(' ');
        const orderLine = data.map((row, index) => `${xFor(index)},${yOrders(row.orders)}`).join(' ');
        const ticks = Array.from({ length: 5 }, (_, index) => (maxRevenue / 4) * index).reverse();
        const labelStep = Math.max(1, Math.ceil(data.length / 6));
        const latest = data[data.length - 1];

        return {
            data,
            width,
            height,
            padding,
            xFor,
            yRevenue,
            yOrders,
            revenueLine,
            orderLine,
            ticks,
            labelStep,
            latest,
        };
    }, [rows]);

    if (!chart) {
        return (
            <div className="report-chart-empty">
                <span className="muted">No paid sales in this period.</span>
            </div>
        );
    }

    return (
        <div className="report-chart">
            <div className="report-chart-summary">
                <div>
                    <span className="chart-dot income" />
                    <small>Latest revenue</small>
                    <strong>{money(chart.latest.revenue)}</strong>
                </div>
                <div>
                    <span className="chart-dot net" />
                    <small>Latest orders</small>
                    <strong>{chart.latest.orders}</strong>
                </div>
            </div>
            <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Sales by day line chart">
                {chart.ticks.map((tick) => (
                    <g key={tick}>
                        <line
                            className="chart-grid-line"
                            x1={chart.padding.left}
                            x2={chart.width - chart.padding.right}
                            y1={chart.yRevenue(tick)}
                            y2={chart.yRevenue(tick)}
                        />
                        <text className="chart-y-label" x={chart.padding.left - 10} y={chart.yRevenue(tick) + 4}>
                            {money(tick)}
                        </text>
                    </g>
                ))}
                <polyline className="chart-line income" points={chart.revenueLine} />
                <polyline className="chart-line net chart-line-secondary" points={chart.orderLine} />
                {chart.data.map((row, index) => (
                    <circle key={`revenue-${row.day}`} className="chart-point income" cx={chart.xFor(index)} cy={chart.yRevenue(row.revenue)} r="3.5">
                        <title>{`${row.day} revenue: ${money(row.revenue)}`}</title>
                    </circle>
                ))}
                {chart.data.map((row, index) => (
                    <circle key={`orders-${row.day}`} className="chart-point net" cx={chart.xFor(index)} cy={chart.yOrders(row.orders)} r="3.5">
                        <title>{`${row.day} orders: ${row.orders}`}</title>
                    </circle>
                ))}
                {chart.data.map((row, index) => (
                    (index % chart.labelStep === 0 || index === chart.data.length - 1) && (
                        <text key={row.day} className="chart-x-label" x={chart.xFor(index)} y={chart.height - 10}>
                            {row.day.slice(5)}
                        </text>
                    )
                ))}
            </svg>
        </div>
    );
}

function InsightCard({ label, value, caption }) {
    return (
        <article className="report-insight">
            <small>{label}</small>
            <strong>{value}</strong>
            <p>{caption}</p>
        </article>
    );
}

function ReportTabs({ view, canViewSales, canViewInventory, appBase }) {
    const tabs = [
        ...(canViewSales ? [{ key: 'sales', label: 'Sales' }, { key: 'pos', label: 'POS' }] : []),
        ...(canViewInventory ? [{ key: 'inventory', label: 'Inventory' }, { key: 'health', label: 'Health' }] : []),
    ];

    return (
        <nav className="report-tabs" aria-label="Report sections">
            {tabs.map((tab) => (
                <Link
                    key={tab.key}
                    href={routeWithBase(`/admin/reports?view=${tab.key}`, appBase)}
                    className={view === tab.key ? 'active' : ''}
                >
                    {tab.label}
                </Link>
            ))}
        </nav>
    );
}

function ReportFilters({ view, filters, locations, appBase, showDates = false, showStock = false }) {
    const query = new URLSearchParams({ view });
    Object.entries(filters || {}).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') query.set(key, value);
    });

    return (
        <div className="report-filter-bar">
            <form method="get" action={routeWithBase('/admin/reports', appBase)}>
                <input type="hidden" name="view" value={view} />
                <label>
                    <span>Warehouse</span>
                    <select name="location_id" defaultValue={filters?.location_id || ''}>
                        <option value="">All accessible</option>
                        {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                    </select>
                </label>
                {showDates && (
                    <>
                        <label><span>From</span><input type="date" name="from" defaultValue={filters?.from || ''} /></label>
                        <label><span>To</span><input type="date" name="to" defaultValue={filters?.to || ''} /></label>
                    </>
                )}
                {showStock && (
                    <>
                        <label><span>Search</span><input type="search" name="q" defaultValue={filters?.q || ''} placeholder="Product or SKU" /></label>
                        <label>
                            <span>Stock status</span>
                            <select name="stock_status" defaultValue={filters?.stock_status || ''}>
                                <option value="">All stock</option>
                                <option value="low">Low stock</option>
                                <option value="out">Out of stock</option>
                            </select>
                        </label>
                    </>
                )}
                <button className="btn secondary" type="submit"><Icon name="search" size={14} /> Apply</button>
            </form>
            <a className="btn secondary" href={`${routeWithBase('/admin/reports/export', appBase)}?${query.toString()}`}>
                <Icon name="download" size={14} /> CSV
            </a>
        </div>
    );
}

function InventoryReport({ report, filters, locations, appBase }) {
    const summary = report.summary || {};
    return (
        <>
            <ReportFilters view="inventory" filters={filters} locations={locations} appBase={appBase} showStock />
            <div className="metrics-grid four">
                <MetricCard label="Original valuation" value={money(summary.cost_value)} hint={`${summary.on_hand || 0} units on hand`} icon="wallet" />
                <MetricCard label="Retail value" value={money(summary.retail_value)} hint={`${summary.available || 0} available`} icon="chart" tone="success" />
                <MetricCard label="Low stock" value={summary.low_stock || 0} hint="At reorder point" icon="bell" />
                <MetricCard label="Out of stock" value={summary.out_of_stock || 0} hint={`${summary.reserved || 0} units reserved`} icon="box" />
            </div>

            <div className="reports-layout">
                <section className="panel glass">
                    <PanelHeading eyebrow="Warehouse balances" title="Stock risk and valuation" />
                    <div className="table-wrap report-products-table">
                        <table>
                            <thead><tr><th>Product / SKU</th><th>Warehouse</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Reorder</th><th>Original value</th></tr></thead>
                            <tbody>
                                {report.stock_rows.length === 0 ? <tr><td colSpan={7}><span className="muted">No balances match these filters.</span></td></tr> : report.stock_rows.map((row) => (
                                    <tr key={row.id}>
                                        <td><strong>{row.product_name}</strong><small>{row.sku_code}</small></td>
                                        <td>{row.location_name}</td><td>{row.on_hand_qty}</td><td>{row.reserved_qty}</td>
                                        <td><StatusBadge status={Number(row.available_qty) <= 0 ? 'failed' : Number(row.available_qty) <= Number(row.reorder_point) ? 'warning' : 'healthy'} label={String(row.available_qty)} /></td>
                                        <td>{row.reorder_point}</td><td><strong>{money(row.cost_value)}</strong></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <div className="report-analysis-grid">
                    <section className="panel glass">
                        <PanelHeading eyebrow="Last 30 days" title="Movement activity" />
                        <div className="report-pair-list">
                            {report.movements.length === 0 ? <p className="muted">No recent movements.</p> : report.movements.map((row) => (
                                <article className="report-pair" key={row.type}><strong>{row.type.replaceAll('_', ' ')}</strong><small>{row.movements} movements</small><span>{row.net_quantity} net / {row.absolute_quantity} handled</span></article>
                            ))}
                        </div>
                    </section>
                    <section className="panel glass">
                        <PanelHeading eyebrow="Shrinkage" title="Adjustment variance" />
                        <div className="table-wrap report-products-table"><table><thead><tr><th>Reason</th><th>Documents</th><th>Variance</th><th>Loss value</th></tr></thead><tbody>
                            {report.adjustments.length === 0 ? <tr><td colSpan={4}><span className="muted">No posted adjustments.</span></td></tr> : report.adjustments.map((row) => <tr key={row.reason_code}><td><strong>{row.reason_code.replaceAll('_', ' ')}</strong></td><td>{row.documents}</td><td>{row.net_quantity}</td><td>{money(row.loss_value)}</td></tr>)}
                        </tbody></table></div>
                    </section>
                </div>

                <div className="report-analysis-grid">
                    <section className="panel glass">
                        <PanelHeading eyebrow="Last 30 days" title="Transfer activity" />
                        <div className="table-wrap report-products-table"><table><thead><tr><th>Transfer</th><th>Route</th><th>Units</th><th>Date</th></tr></thead><tbody>
                            {report.transfers.length === 0 ? <tr><td colSpan={4}><span className="muted">No recent transfers.</span></td></tr> : report.transfers.map((row) => <tr key={row.id}><td><strong>{row.transfer_number}</strong></td><td>{row.source_name} to {row.destination_name}</td><td>{row.moved_quantity}</td><td>{new Date(row.created_at).toLocaleDateString()}</td></tr>)}
                        </tbody></table></div>
                    </section>
                    <section className="panel glass">
                        <PanelHeading eyebrow="Last 30 days" title="SKU sell-through" />
                        <div className="table-wrap report-products-table"><table><thead><tr><th>Product / SKU</th><th>Sold</th><th>On hand</th><th>Rate</th></tr></thead><tbody>
                            {report.sell_through.length === 0 ? <tr><td colSpan={4}><span className="muted">No paid sales for this warehouse.</span></td></tr> : report.sell_through.map((row) => <tr key={row.id}><td><strong>{row.product_name}</strong><small>{row.sku_code}</small></td><td>{row.units_sold}</td><td>{row.on_hand_qty || 0}</td><td><strong>{percent(row.sell_through_rate)}</strong></td></tr>)}
                        </tbody></table></div>
                    </section>
                </div>
            </div>
        </>
    );
}

function PosReport({ report, filters, locations, appBase }) {
    const summary = report.summary || {};
    return (
        <>
            <ReportFilters view="pos" filters={filters} locations={locations} appBase={appBase} showDates />
            <div className="metrics-grid four">
                <MetricCard label="POS revenue" value={money(summary.revenue)} hint={`${summary.orders || 0} completed sales`} icon="wallet" tone="success" />
                <MetricCard label="Average sale" value={money(summary.average_sale)} hint={report.own_only ? 'Your shifts only' : 'All accessible warehouses'} icon="receipt" />
                <MetricCard label="Discounts" value={money(summary.discounts)} hint="POS order discounts" icon="tag" />
                <MetricCard label="Closed shifts" value={report.shifts.filter((shift) => shift.status === 'closed').length} hint={`${report.shifts.length} shifts in period`} icon="card" />
            </div>
            <div className="reports-layout">
                <div className="report-analysis-grid">
                    <section className="panel glass"><PanelHeading eyebrow="Warehouse performance" title="Sales by warehouse" /><div className="report-pair-list">{report.by_location.length === 0 ? <p className="muted">No POS sales in this period.</p> : report.by_location.map((row) => <article className="report-pair" key={row.id}><strong>{row.name}</strong><small>{row.orders} sales</small><span>{money(row.revenue)}</span></article>)}</div></section>
                    <section className="panel glass"><PanelHeading eyebrow="Payment mix" title="Tender breakdown" /><div className="report-pair-list">{report.tenders.length === 0 ? <p className="muted">No payments in this period.</p> : report.tenders.map((row) => <article className="report-pair" key={row.tender_type}><strong>{row.tender_type || 'Other'}</strong><small>{row.payments} payments</small><span>{money(row.amount)}</span></article>)}</div></section>
                </div>
                <div className="report-analysis-grid">
                    <section className="panel glass"><PanelHeading eyebrow="Register performance" title="Sales by register" /><div className="table-wrap report-products-table"><table><thead><tr><th>Register</th><th>Orders</th><th>Revenue</th></tr></thead><tbody>{report.by_register.length === 0 ? <tr><td colSpan={3}><span className="muted">No register sales.</span></td></tr> : report.by_register.map((row) => <tr key={row.id}><td><strong>{row.name}</strong><small>{row.code}</small></td><td>{row.orders}</td><td>{money(row.revenue)}</td></tr>)}</tbody></table></div></section>
                    <section className="panel glass"><PanelHeading eyebrow="Team performance" title="Sales by cashier" /><div className="table-wrap report-products-table"><table><thead><tr><th>Cashier</th><th>Orders</th><th>Revenue</th></tr></thead><tbody>{report.by_cashier.length === 0 ? <tr><td colSpan={3}><span className="muted">No cashier sales.</span></td></tr> : report.by_cashier.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.orders}</td><td>{money(row.revenue)}</td></tr>)}</tbody></table></div></section>
                </div>
                <section className="panel glass"><PanelHeading eyebrow={`${report.from} to ${report.to}`} title="Shift reconciliation" /><div className="table-wrap report-products-table"><table><thead><tr><th>Shift</th><th>Cashier</th><th>Register</th><th>Cash sales</th><th>Expected</th><th>Counted</th><th>Variance</th></tr></thead><tbody>{report.shifts.length === 0 ? <tr><td colSpan={7}><span className="muted">No shifts in this period.</span></td></tr> : report.shifts.map((row) => <tr key={row.id}><td><strong>#{row.id}</strong><small>{row.opened_at}</small></td><td>{row.cashier_name}</td><td><strong>{row.register_name}</strong><small>{row.location_name}</small></td><td>{money(row.cash_sales)}</td><td>{money(row.expected_cash)}</td><td>{row.counted_cash === null ? '-' : money(row.counted_cash)}</td><td><StatusBadge status={Math.abs(Number(row.variance || 0)) > 0.01 ? 'warning' : 'healthy'} label={row.variance === null ? 'Open' : money(row.variance)} /></td></tr>)}</tbody></table></div></section>
            </div>
        </>
    );
}

function HealthReport({ report }) {
    return (
        <>
            <div className="metrics-grid four">
                <MetricCard label="Healthy checks" value={report.summary.healthy} hint="Latest system snapshots" icon="check" tone="success" />
                <MetricCard label="Warnings" value={report.summary.warnings} hint="Configuration or workflow" icon="bell" />
                <MetricCard label="Failed checks" value={report.summary.failed} hint={`${report.summary.failed_jobs} failed jobs`} icon="close" />
                <MetricCard label="Stock alerts" value={report.summary.open_alerts} hint="Open reorder alerts" icon="box" />
            </div>
            <div className="reports-layout">
                <section className="panel glass"><PanelHeading eyebrow="Latest snapshots" title="Operations health" /><div className="operations-health-grid">{report.checks.length === 0 ? <p className="muted">Run the operations health command to create the first snapshot.</p> : report.checks.map((check) => <article key={check.check_name} className="operations-health-row"><StatusBadge status={check.status} label={check.status} /><div><strong>{check.check_name.replaceAll('_', ' ')}</strong><p>{check.summary}</p><small>{check.checked_at}</small></div></article>)}</div></section>
                <section className="panel glass"><PanelHeading eyebrow="Reorder queue" title="Open stock alerts" /><div className="table-wrap report-products-table"><table><thead><tr><th>Product / SKU</th><th>Warehouse</th><th>Available</th><th>Reorder</th><th>Severity</th></tr></thead><tbody>{report.alerts.length === 0 ? <tr><td colSpan={5}><span className="muted">No open stock alerts.</span></td></tr> : report.alerts.map((alert) => <tr key={alert.id}><td><strong>{alert.sku?.product?.name}</strong><small>{alert.sku?.sku_code}</small></td><td>{alert.location?.name}</td><td>{alert.available_qty}</td><td>{alert.reorder_point}</td><td><StatusBadge status={alert.type === 'out_of_stock' ? 'failed' : 'warning'} label={alert.type.replaceAll('_', ' ')} /></td></tr>)}</tbody></table></div></section>
            </div>
        </>
    );
}

export default function ReportsIndex({ view = 'sales', filters = {}, locations = [], canViewSales = false, canViewInventory = false, inventoryReport = null, posReport = null, healthReport = null, summary = {}, topProducts = [], salesByDay = [], categoryPerformance = [], purchaseSegments = [], productPairs = [], couponPerformance = [], flashSalePerformance = [] }) {
    const { app_base } = usePage().props;
    const topRevenue = Math.max(...topProducts.map((product) => Number(product.revenue || 0)), 1);
    const topCategoryRevenue = Math.max(1, ...categoryPerformance.map((category) => Number(category.revenue || 0)));
    const topSegmentOrders = Math.max(1, ...purchaseSegments.map((segment) => Number(segment.orders || 0)));

    return (
        <AdminLayout title="Reports" eyebrow="Analytics">
            <Head title="Reports" />
            <ReportTabs view={view} canViewSales={canViewSales} canViewInventory={canViewInventory} appBase={app_base} />

            {view === 'sales' && (
            <>
            <div className="metrics-grid four">
                <MetricCard label="Paid orders" value={summary.paid_orders} hint="Confirmed payments" icon="receipt" />
                <MetricCard label="Revenue" value={money(summary.revenue)} hint="Paid order total" icon="wallet" tone="success" />
                <MetricCard label="Customers" value={summary.customers} hint="Registered accounts" icon="users" />
                <MetricCard label="Products" value={summary.products} hint="Catalog items" icon="box" />
            </div>

            <div className="reports-layout">
                <section className="panel glass">
                    <PanelHeading eyebrow="Marketing signals" title="Purchase health" />
                    <div className="report-insight-grid">
                        <InsightCard
                            label="Average order value"
                            value={money(summary.average_order_value)}
                            caption="Use as the minimum target for bundles and free-shipping thresholds."
                        />
                        <InsightCard
                            label="Units per order"
                            value={summary.units_per_order}
                            caption={`${summary.units_sold} units sold across paid orders.`}
                        />
                        <InsightCard
                            label="Repeat customer rate"
                            value={percent(summary.repeat_customer_rate)}
                            caption="Good signal for retention campaigns and loyalty messaging."
                        />
                        <InsightCard
                            label="Discount pressure"
                            value={percent(summary.discount_rate)}
                            caption="Discount share of gross sales before order-level reductions."
                        />
                    </div>
                </section>

                <section className="panel glass">
                    <PanelHeading eyebrow="Last 30 days" title="Sales by day" />
                    <SalesTrendChart rows={salesByDay} />
                </section>

                <div className="report-analysis-grid">
                    <section className="panel glass">
                        <PanelHeading eyebrow="Campaign analytics" title="Coupon performance" />
                        <div className="table-wrap report-products-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Coupon</th>
                                        <th>Paid orders</th>
                                        <th>Discount</th>
                                        <th>Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {couponPerformance.length === 0 ? (
                                        <tr><td colSpan={4}><span className="muted">No coupon campaigns yet.</span></td></tr>
                                    ) : couponPerformance.map((coupon) => (
                                        <tr key={coupon.id}>
                                            <td>
                                                <strong>{coupon.code}</strong>
                                                <small>{coupon.type} / {coupon.value}</small>
                                            </td>
                                            <td>{coupon.paid_orders}</td>
                                            <td><strong>{money(coupon.discount_given)}</strong></td>
                                            <td><strong>{money(coupon.revenue)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="panel glass">
                        <PanelHeading eyebrow="Campaign analytics" title="Flash sale performance" />
                        <div className="table-wrap report-products-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Campaign</th>
                                        <th>SKUs</th>
                                        <th>Units</th>
                                        <th>Est. revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {flashSalePerformance.length === 0 ? (
                                        <tr><td colSpan={4}><span className="muted">No flash sale campaigns yet.</span></td></tr>
                                    ) : flashSalePerformance.map((sale) => (
                                        <tr key={sale.id}>
                                            <td>
                                                <strong>{sale.name}</strong>
                                                <small>{sale.starts_at} to {sale.ends_at}</small>
                                            </td>
                                            <td>{sale.items}</td>
                                            <td>{sale.units_sold}</td>
                                            <td><strong>{money(sale.estimated_revenue)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                <div className="report-analysis-grid">
                    <section className="panel glass">
                        <PanelHeading eyebrow="Category demand" title="Category performance" />
                        <div className="table-wrap report-products-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Category</th>
                                        <th>Orders</th>
                                        <th>Units</th>
                                        <th>Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {categoryPerformance.length === 0 ? (
                                        <tr>
                                            <td colSpan={4}>
                                                <span className="muted">No category sales yet.</span>
                                            </td>
                                        </tr>
                                    ) : categoryPerformance.map((category) => {
                                        const revenue = Number(category.revenue || 0);
                                        return (
                                            <tr key={category.id}>
                                                <td>
                                                    <strong>{category.name}</strong>
                                                    <small>{category.products} sold products</small>
                                                    <div className="report-bar">
                                                        <span style={{ width: `${Math.max(4, (revenue / topCategoryRevenue) * 100)}%` }} />
                                                    </div>
                                                </td>
                                                <td>{category.orders}</td>
                                                <td>{category.units}</td>
                                                <td><strong>{money(revenue)}</strong></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="panel glass">
                        <PanelHeading eyebrow="Purchase behavior" title="Basket analysis" />
                        <div className="report-stack">
                            <div className="report-segments">
                                {purchaseSegments.length === 0 ? (
                                    <p className="muted">No basket data yet.</p>
                                ) : purchaseSegments.map((segment) => {
                                    const orders = Number(segment.orders || 0);
                                    return (
                                        <article key={segment.segment} className="report-segment">
                                            <div>
                                                <strong>{segment.segment}</strong>
                                                <small>{orders} orders / {segment.units} units</small>
                                            </div>
                                            <span>{money(segment.revenue)}</span>
                                            <div className="report-bar">
                                                <span style={{ width: `${Math.max(4, (orders / topSegmentOrders) * 100)}%` }} />
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>

                            <div>
                                <p className="eyebrow">Frequently bought together</p>
                                <div className="report-pair-list">
                                    {productPairs.length === 0 ? (
                                        <p className="muted">No product pair data yet.</p>
                                    ) : productPairs.map((pair) => (
                                        <article key={pair.pair} className="report-pair">
                                            <strong>{pair.pair}</strong>
                                            <small>{pair.orders} shared orders / {pair.units} combined units</small>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <section className="panel glass">
                    <PanelHeading eyebrow="Catalog" title="Top products" />
                    <div className="table-wrap report-products-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Product</th>
                                    <th>Units</th>
                                    <th>Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={4}>
                                            <span className="muted">No paid product sales yet.</span>
                                        </td>
                                    </tr>
                                ) : topProducts.map((product, index) => {
                                    const revenue = Number(product.revenue || 0);
                                    return (
                                        <tr key={product.id}>
                                            <td>
                                                <span className="rank-badge">{index + 1}</span>
                                            </td>
                                            <td>
                                                <strong>{product.name}</strong>
                                                <div className="report-bar">
                                                    <span style={{ width: `${Math.max(4, (revenue / topRevenue) * 100)}%` }} />
                                                </div>
                                            </td>
                                            <td>{product.units}</td>
                                            <td><strong>{money(revenue)}</strong></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
            </>
            )}

            {view === 'inventory' && inventoryReport && <InventoryReport report={inventoryReport} filters={filters} locations={locations} appBase={app_base} />}
            {view === 'pos' && posReport && <PosReport report={posReport} filters={filters} locations={locations} appBase={app_base} />}
            {view === 'health' && healthReport && <HealthReport report={healthReport} />}
        </AdminLayout>
    );
}

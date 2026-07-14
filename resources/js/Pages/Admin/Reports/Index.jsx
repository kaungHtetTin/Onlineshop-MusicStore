import { useMemo } from 'react';
import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';

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

export default function ReportsIndex({ summary, topProducts, salesByDay, categoryPerformance, purchaseSegments, productPairs, couponPerformance = [], flashSalePerformance = [] }) {
    const topRevenue = Math.max(...topProducts.map((product) => Number(product.revenue || 0)), 1);
    const topCategoryRevenue = Math.max(1, ...categoryPerformance.map((category) => Number(category.revenue || 0)));
    const topSegmentOrders = Math.max(1, ...purchaseSegments.map((segment) => Number(segment.orders || 0)));

    return (
        <AdminLayout title="Reports" eyebrow="Analytics">
            <Head title="Reports" />

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
        </AdminLayout>
    );
}

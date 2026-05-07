root = VLayout([header, revenueChart])
header = Text("Monthly Revenue Trend", "large")
revenueChart = LineChart(data.labels, [revenueSeries], "smooth", "Month", "Revenue ($)")
revenueSeries = Series("Revenue", data.series[0].values)
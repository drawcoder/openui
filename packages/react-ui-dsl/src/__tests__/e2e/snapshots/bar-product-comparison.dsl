root = VLayout([header, revenueChart])
header = Text("Quarterly Revenue Comparison", "large")
revenueChart = BarChart(data.labels, data.series, "grouped", "Quarter", "Revenue ($)")
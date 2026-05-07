root = VLayout([header, chart])
header = Text("Top Interfaces by Traffic", "large")
chart = HorizontalBarChart(data.labels, data.series, "grouped", "Traffic (Mbps)", "Interface")
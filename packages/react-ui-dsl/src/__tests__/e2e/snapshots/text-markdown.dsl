root = VLayout([summaryCard])
summaryCard = Card([summaryHeader, growthText])
summaryHeader = Text(data.summary.heading, "large")
growthText = Text("Growth: " + data.summary.growth, "large-heavy")
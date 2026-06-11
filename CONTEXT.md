# Context: OpenUI Domain Glossary

## Core Concepts

### LUI (Language UI)
The conversational dialog area where LLM responses are rendered. Default rendering target for DSL components.

### Canvas (Intelligent Canvas)
A multi-tab visualization workspace independent from LUI dialog. Supports dashboard cards, previews, and embedded HTML content.

### DashboardTab
A tab within Canvas that displays DashboardCard components in a 12-column grid layout.

### PreviewTab
A tab within Canvas that renders PreviewCard content in full-page mode. Each PreviewCard occupies its own tab.

### HTMLLoader Tab
A tab within Canvas that embeds external HTML content via iframe with bidirectional postMessage communication. Each HTMLLoader occupies its own tab. iframeId serves as the communication identifier.

## DSL Components

### DashboardCard
A DSL component that renders to DashboardTab in Canvas. Displays as a grid card with optional title and size constraints.

### PreviewCard
A DSL component that renders to a dedicated PreviewTab in Canvas. Title defines the tab name, content fills the entire tab area. HTMLLoader can be used as PreviewCard children for iframe embedding.

### HTMLLoader
A DSL component for iframe embedding with bidirectional communication. Used as PreviewCard children. Args: url (required, iframe source), iframeId (required, communication identifier), data (optional, object sent to iframe after ready signal). Communication protocol: iframe sends `{type: "openui-ready", iframeId}` when loaded → HTMLLoader sends `{type: "openui-data", iframeId, data}` → iframe can send `{type: "openui-close", iframeId}` to request tab removal.

## Rendering Targets

### LUI Target
Default rendering destination. Components without canvas-specific markers render to the LUI dialog area.

### Canvas Target
Rendering destination for DashboardCard, PreviewCard, and HTMLLoader components. These components push data to canvasStore and render in Canvas instead.

## Layout Concepts

### Grid Layout
12-column fixed grid used by DashboardTab. Cards arranged left-to-right, wrapping to next row when space insufficient.

### Full-Page Layout
Layout mode for PreviewTab where content occupies entire tab area without grid constraints.

### Grid Unit
Size measurement unit for DashboardCard. `{w: number}` represents column span (1-12). Default width is 6 columns.

## ElementNode

Parsed representation of a DSL component invocation. Contains `typeName`, `props`, `statementId`, and `partial` flag.

### CanvasItem
Union type of canvas-renderable ElementNodes: `DashboardCardNode | PreviewCardNode | HTMLLoaderNode`. Distinguished by `typeName` field.
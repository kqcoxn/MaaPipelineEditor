> [!TIP]
> 本文档为AI生成后改编的版本，仅供参考，推荐使用在线网站尝试一两个节点后观察JSON预览以熟悉格式

This page provides comprehensive instructions for installing, configuring, and beginning to use YAMaaPE (Yet Another Maa Pipeline Editor). YAMaaPE is a visual workflow editor for creating MaaFramework Pipeline configurations through an intuitive graphical interface.  
本页面提供了安装、配置和开始使用 YAMaaPE（Yet Another Maa Pipeline Editor）的全面说明。YAMaaPE 是一个通过直观的图形界面创建 MaaFramework Pipeline 配置的可视化工作流编辑器。

For information about the overall architecture and component structure, see [Architecture Overview](https://deepwiki.com/kqcoxn/YAMaaPE/2-architecture-overview).  
有关总体架构和组件结构的信息，请参见架构概述。

## Prerequisites  先决条件

Before installing YAMaaPE, ensure you have the following prerequisites installed on your system:  
在安装 YAMaaPE 之前，请确保您的系统上已安装以下先决条件：

-   Node.js (v16.0.0 or later recommended)  
    Node.js (建议使用 v16.0.0 或更高版本)
-   npm (v7.0.0 or later) or yarn  
    npm（推荐版本 7.0.0 或更高版本）或 yarn


## Installation Options  安装选项

There are two primary ways to use YAMaaPE:  
使用 YAMaaPE 有两大主要方式：

1.  **Online Demo**: Use the pre-deployed version without any installation  
    在线演示：使用已预部署的版本，无需安装
2.  **Local Installation**: Clone and run the repository locally for development or personal use  
    本地安装：克隆并本地运行仓库以进行开发或个人使用

### Option 1: Online Demo  选项 1: 在线演示

YAMaaPE is available as an online demo that requires no installation:  
YAMaaPE 可以作为在线演示提供，无需安装：

```bash
https://yamaape.codax.site/
```

This is the quickest way to start using YAMaaPE without any setup.  
这是使用 YAMaaPE 的最快方式，无需任何设置。

### Option 2: Local Installation  选项 2: 本地安装

To install YAMaaPE locally:  
要本地安装 YAMaaPE：

1.  **Clone the repository:  克隆仓库:**
    
    ```
    git clone https://github.com/kqcoxn/YAMaaPE.git
    cd YAMaaPE
    ```
    
2.  **Install dependencies:  安装依赖:**
    
    ```
    npm install
    # or if you prefer yarn
    yarn
    ```
    
3.  **Start the development server:  
    启动开发服务器：**
    
    ```
    npm run dev
    # or with yarn
    yarn dev
    ```
    
4.  **Access the application:** Open your browser and navigate to `http://localhost:5173` (or the URL displayed in your terminal).  
    访问应用: 在浏览器中导航到 `http://localhost:5173` （或终端中显示的 URL）。
    

## Getting Started  快速上手

Once you have YAMaaPE running, you can begin creating your first pipeline. This section provides a basic walkthrough of essential operations.  
一旦 YAMaaPE 运行起来，你就可以开始创建你的第一个管道。本节提供了一些基本的操作流程。

### Interface Overview  界面概述

When you first open YAMaaPE, you'll see an interface with several key areas:  
当你首次打开 YAMaaPE 时，你会看到一个包含几个关键区域的界面：

-   **Workspace Canvas**: The main area where you'll create and connect nodes  
    工作区画布：你将在此创建和连接节点的主要区域
-   **Toolbar**: Provides tools for adding nodes and performing actions  
    工具栏：提供添加节点和执行操作的工具
-   **Attribute Panel**: Displays editable properties of selected nodes  
    属性面板：显示所选节点的可编辑属性
-   **JSON Viewer**: Shows the generated Pipeline JSON configuration  
    JSON 查看器：显示生成的 Pipeline JSON 配置
-   **Settings Panel**: Contains application-wide settings  
    设置面板：包含应用程序级别的设置

### Basic Workflow  基本工作流

1.  **Add a node**:  添加一个节点：
    
    -   Click on the "+" button in the toolbar  
        点击工具栏中的 "+" 按钮
    -   Select a node type from the available templates  
        选择一个节点类型从可用的模板
2.  **Configure node properties**:  
    配置节点属性：
    
    -   Select a node by clicking on it  
        点击节点以选择它
    -   Edit its properties in the Attribute Panel  
        编辑其属性在属性面板中
    -   YAMaaPE will provide field validation and suggestions  
        YAMaaPE 将提供字段验证和建议
3.  **Connect nodes**:  连接节点：
    
    -   Click and drag from a node's output handle to another node's input handle  
        从一个节点的输出句柄拖动到另一个节点的输入句柄
    -   Connections represent the flow of execution (next, on\_error, interrupt)  
        连接表示执行的流动（next, on\_error, interrupt）
4.  **Preview and export**:  预览和导出：
    
    -   Review the generated JSON in the JSON Viewer panel  
        在 JSON 查看器面板中审查生成的 JSON
    -   Export the JSON for use with MaaFramework  
        导出 JSON 以与 MaaFramework 使用

### File Management  文件管理

YAMaaPE supports working with multiple files and provides several options for saving your work:  
YAMaaPE 支持处理多个文件，并提供了几种保存工作的选项：

-   **Local Cache**: Your work is automatically saved to browser local storage  
    本地缓存：您的工作会自动保存到浏览器本地存储中
-   **Import/Export**: You can import existing Pipeline JSON or export your work  
    导入/导出：您可以导入现有的 Pipeline JSON 或导出您的工作
-   **Multi-file Editing**: Switch between multiple pipeline files  
    多文件编辑：在多个 pipeline 文件之间切换

To create a new file:  
创建新文件：

1.  Click on the file management options in the toolbar  
    点击工具栏上的文件管理选项
2.  Select "New File"  选择“新建文件”
3.  Provide a name for your file  
    为您的文件命名

To import an existing JSON:  
为了导入现有 JSON：

1.  Click the import button  
    点击导入按钮
2.  Select your JSON file  
    选择您的 JSON 文件
3.  YAMaaPE will convert it into a visual workflow  
    YAMaaPE 将将其转换为可视化工作流

## Node Types and Configuration  节点类型和配置

YAMaaPE supports various node types from the MaaFramework Pipeline protocol:  
YAMaaPE 支持来自 MaaFramework 管道协议的各种节点类型:

### Recognition Methods  识别方法

-   DirectHit  直接命中
-   TemplateMatch  模板匹配
-   OCR
-   FeatureMatch  特征匹配

### Action Types  动作类型

-   Click  点击
-   DoNothing  不做任何事情

Each node type has specific properties that can be configured through the Attribute Panel.  
每个节点类型都有特定的属性，可以通过属性面板进行配置。

YAMaaPE provides helpful features for node configuration:  
YAMaaPE 提供了有助于节点配置的功能：

-   Type prediction for fields  
    类型预测
-   Field descriptions  字段描述
-   Error checking  错误检查
-   Automatic generation of required fields  
    自动生成所需字段
-   Automatic addition of necessary edge connections (next, interrupt, on\_error)  
    自动添加必要的边缘连接（next、interrupt、on\_error）

## Key Features  核心功能

|        Feature  功能        |                            Description  描述                            |
|---------------------------|-----------------------------------------------------------------------|
|   Workflow Panel  工作流面板   | Interactive canvas for creating node connections 交互式画布用于创建节点连接 |
|   Field Filtering  字段过滤   | Shows only relevant extra fields based on node type 根据节点类型仅显示相关额外字段 |
|    Type Hinting  类型提示     | Provides field descriptions and type predictions  提供字段描述和类型预测 |
|   Error Checking  错误检查    | Validates your configuration as you build it  在构建过程中验证您的配置 |
|   Auto-generation  自动生成   | Automatically adds required fields and connections  自动添加所需字段和连接 |
|   JSON Preview  JSON 预览   | Real-time preview of the generated pipeline JSON  生成的管道 JSON 的实时预览 |
|   Import/Export  导入/导出    | Import existing JSON or export your configuration  导入现有 JSON 或导出您的配置 |
| Multi-file Support  多文件支持 | Work with multiple pipeline files simultaneously  同时处理多个管道文件 |
|    Local Caching  本地缓存    | Automatically saves your work in browser storage  在浏览器存储中自动保存您的工作 |

## Node Creation and Connection  节点创建和连接

Creating a functional pipeline requires properly connecting nodes to define the workflow:  
创建一个功能性的流水线需要正确地连接节点以定义工作流程:

The connection types have specific meanings:  
连接类型具有特定的含义：

-   **next**: Normal flow path when a node completes successfully  
    next: 节点成功完成后正常的流程路径
-   **on\_error**: Path taken when a node encounters an error  
    on\_error: 遇到错误时采取的路径
-   **interrupt**: Special flow control to break normal execution  
    interrupt: 特殊的流程控制以中断正常的执行

YAMaaPE automatically handles the creation of these connection fields in the underlying JSON.  
YAMaaPE 自动处理这些连接字段在底层 JSON 中的创建。

## Usage Tips

-   **Template Nodes**: Use predefined template nodes to quickly create common configurations  
    模板节点: 使用预定义的模板节点快速创建常见配置
-   **Positioning**: Use the auto-layout feature to organize your nodes neatly  
    布局: 使用自动布局功能将节点整齐排列
-   **Multi-select**: Hold Shift to select multiple nodes for bulk operations  
    多选: 按住 Shift 键以选择多个节点进行批量操作
-   **Keyboard Shortcuts**:   键盘快捷键:
    -   Delete/Backspace: Delete selected nodes  
        Delete/Backspace: 删除选定节点
    -   Ctrl+C/Ctrl+V: Copy and paste nodes  
        Ctrl+C/Ctrl+V: 复制和粘贴节点
    -   Ctrl+S: Save current file  
        Ctrl+S: 保存当前文件


## Troubleshooting  故障排除

If you encounter issues:  
如果遇到问题:

1.  **JSON Import Errors**: Ensure your JSON is valid MaaFramework Pipeline format  
    JSON 导入错误：确保您的 JSON 是有效的 MaaFramework 管道格式
2.  **Missing Connections**: Check that nodes are properly connected with appropriate edge types  
    缺失连接：检查节点是否已使用适当的边类型正确连接
3.  **Field Validation**: Review error messages in the Attribute Panel for invalid fields  
    字段验证：在属性面板中查看无效字段的错误消息
4.  **Browser Compatibility**: YAMaaPE works best in modern browsers (Chrome, Firefox, Edge)  
    浏览器兼容性：YAMaaPE 最佳运行在现代浏览器中（Chrome、Firefox、Edge）

If problems persist, check the GitHub repository for known issues or to report new ones.  
如果问题仍然存在，请检查 GitHub 仓库以查看已知问题或报告新问题。


## Next Steps  接下来步骤

Once you've created your first basic pipeline, consider exploring:  
创建了第一个基本管道后，可以考虑探索：

-   Complex branching workflows with error handling  
    具有错误处理的复杂分支工作流
-   Different recognition methods for various scenarios  
    各种场景下的不同识别方法
-   The full range of action types  
    动作类型的完整范围
-   Exporting and testing your pipeline with MaaFramework  
    使用 MaaFramework 导出和测试您的管道

For more details about the component architecture, see [Component Architecture](https://deepwiki.com/kqcoxn/YAMaaPE/2.1-component-architecture) and [Visual Editor Components](https://deepwiki.com/kqcoxn/YAMaaPE/3-visual-editor-components).  
对于组件架构的更多细节，请参阅组件架构和可视化编辑器组件。

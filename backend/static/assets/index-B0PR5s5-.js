(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const l of document.querySelectorAll('link[rel="modulepreload"]'))s(l);new MutationObserver(l=>{for(const o of l)if(o.type==="childList")for(const d of o.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&s(d)}).observe(document,{childList:!0,subtree:!0});function r(l){const o={};return l.integrity&&(o.integrity=l.integrity),l.referrerPolicy&&(o.referrerPolicy=l.referrerPolicy),l.crossOrigin==="use-credentials"?o.credentials="include":l.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function s(l){if(l.ep)return;l.ep=!0;const o=r(l);fetch(l.href,o)}})();const Et="modulepreload",Ct=function(e){return"/ui/"+e},Ie={},Nt=function(a,r,s){let l=Promise.resolve();if(r&&r.length>0){let h=function(m){return Promise.all(m.map(S=>Promise.resolve(S).then(F=>({status:"fulfilled",value:F}),F=>({status:"rejected",reason:F}))))};var d=h;document.getElementsByTagName("link");const c=document.querySelector("meta[property=csp-nonce]"),p=c?.nonce||c?.getAttribute("nonce");l=h(r.map(m=>{if(m=Ct(m),m in Ie)return;Ie[m]=!0;const S=m.endsWith(".css"),F=S?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${m}"]${F}`))return;const v=document.createElement("link");if(v.rel=S?"stylesheet":Et,S||(v.as="script"),v.crossOrigin="",v.href=m,p&&v.setAttribute("nonce",p),document.head.appendChild(v),S)return new Promise((R,K)=>{v.addEventListener("load",R),v.addEventListener("error",()=>K(new Error(`Unable to preload CSS for ${m}`)))})}))}function o(c){const p=new Event("vite:preloadError",{cancelable:!0});if(p.payload=c,window.dispatchEvent(p),!p.defaultPrevented)throw c}return l.then(c=>{for(const p of c||[])p.status==="rejected"&&o(p.reason);return a().catch(o)})};async function Dt(e,a,r,s=globalThis){const l=await s.fetch(e,{headers:{Authorization:`Bearer ${a}`}});if(!l.ok)throw new Error(`Artifact download failed (${l.status})`);const o=await l.blob(),d=s.URL.createObjectURL(o),c=s.document.createElement("a");c.href=d,c.download=r.split("/").pop()||"artifact";try{s.document.body.appendChild(c),c.click()}finally{c.remove(),s.setTimeout(()=>s.URL.revokeObjectURL(d),6e4)}}const It="/ui/assets/pdf.worker-iVMkNdeB.mjs",je=[{id:"en",label:"EN",name:"English"},{id:"zh-Hans",label:"简",name:"简体中文"},{id:"zh-Hant",label:"繁",name:"繁體中文"}],Be={en:{app:{title:"AI Learning Assistant - Artifact Studio",brand:"AI Learning Assistant",userFallback:"User"},locale:{label:"Interface language"},mobile:{console:"Console",preview:"Preview"},pane:{consoleKicker:"Production console",previewKicker:"Artifact preview"},actions:{model:"Model",copyPath:"Copy path",reveal:"Reveal",regenerate:"Regenerate",copy:"Copy",download:"Download",open:"Open",runArtifact:"Run artifact",runAgain:"Run again",running:"Running",newRevisionRun:"New revision run",copyVisible:"Copy visible",test:"Test",save:"Save",saving:"Saving",login:"Login",createAccount:"Create account",closeModel:"Close model settings",removeFile:"Remove {name}"},intents:{code_homework:{label:"Code",short:"PY",title:"Homework code",description:"Script or notebook answer",primaryTab:"Code",sourceTab:"Source"},essay_latex:{label:"Essay",short:"HTML",title:"HTML essay",description:"HTML source plus PDF",primaryTab:"Rendered",sourceTab:"HTML"},beamer_slides:{label:"Slides",short:"PDF",title:"HTML deck",description:"Slide HTML plus PDF",primaryTab:"Rendered",sourceTab:"HTML"},cheat_sheet:{label:"Cheat sheet",short:"A4",title:"Dense A4 sheet",description:"Course compression HTML plus PDF",primaryTab:"Rendered",sourceTab:"HTML"}},controls:{artifactType:"Artifact type",search:"Search",searchMode:{auto:"Auto",on:"On",off:"Off"},output:"Output",previewOnly:"Preview only",targetPages:"Target pages",a4:"A4",dense:"Dense",pdfFirst:"HTML preview first",sourceKept:"Source kept"},course:{label:"Course context",defaultTitle:"Just Asking",contextDisabled:"Context off",contextEnabled:"Context on",defaultNote:"General work; no course memory is added.",contextNote:"Compact course memory may inform this run.",manage:"Manage",done:"Done",loading:"Loading courses...",unavailable:"Courses unavailable",newTitle:"New course",newPlaceholder:"e.g. Machine Learning",selectedTitle:"Selected course name",create:"Create",rename:"Rename",archive:"Archive",defaultLocked:"The default course is always available and cannot be renamed or archived.",titleRequired:"Enter a course name.",creating:"Creating course.",created:"Course created and selected.",createFailed:"Course creation failed.",renaming:"Renaming course.",renamed:"Course renamed.",renameFailed:"Course rename failed.",archiving:"Archiving course.",archived:"Course archived. Historical runs remain available.",archiveFailed:"Course archive failed.",loadFailed:"Course list could not be loaded."},composer:{brief:"Brief",briefPlaceholder:"Paste the assignment brief, constraints, marking expectations, and any output notes.",runNoteLogin:"Login activates generation controls.",runNoteBrief:"Add a task brief to enable generation.",runNoteUploads:"Selected files upload before run creation.",runNoteRunning:"Context and stage events update as the backend reports.",runNoteReady:"Ready for a local generation run.",progressLabel:"Approximate progress",progressNote:"This bar is a comfort estimate while the backend works; stage text is authoritative.",progressAria:"Approximate generation progress"},uploads:{label:"Reference files",choose:"Drop or choose reference files",selected:"{count} reference file selected",selectedPlural:"{count} reference files selected",willUpload:"Files will upload before the next run.",duplicates:"Those files are already selected.",uploaded:"uploaded",uploading:"uploading",failed:"upload failed",unavailable:"Upload API is unavailable in this backend build.",failedGeneric:"Upload failed.",missingIds:"Upload response did not include every upload id."},refinement:{label:"Follow-up",availableAfterRun:"Available after first run",revisionSource:"Revision source {id}",placeholder:"Ask for a tighter proof, more comments, fewer slides, or a different structure.",note:"Creates a new run; generated files stay source-of-truth on disk.",missing:"Add a follow-up request before starting a revision."},history:{label:"Run history",entries:"{count} entries",readyTitle:"Console ready",readyMessage:"Choose an artifact type, add source material, then run.",followUpTitle:"Follow-up request",regenerateTitle:"Regenerate request",generationTitle:"Generation request",runTitle:"Run {id}",folderPending:"folder pending"},preview:{tabs:{logs:"Logs",manifest:"Manifest"},statusMessage:"Run status",stageProgress:"Stage progress",currentStage:"Current: {stage}",emptyPdfTitle:"PDF renderer",emptyPdfMessage:"Pages are shown as PDF-like preview until artifact bytes are exposed.",htmlDocumentTitle:"HTML preview",htmlLoading:"Rendering HTML",htmlLoadingMessage:"Loading authenticated HTML source into the sandboxed preview.",htmlRendererError:"HTML preview unavailable",htmlRenderReady:"Rendered from the generated HTML artifact.",htmlFrameTitle:"Generated HTML artifact preview",pdfFallbackAvailable:"PDF output remains available for inspection.",pdfLoading:"Rendering PDF",pdfLoadingMessage:"Loading authenticated artifact bytes and painting the page.",pdfRendererError:"PDF preview unavailable",pdfRenderReady:"Rendered from the generated PDF artifact.",pdfPagePosition:"Page {page} / {total}",pdfSlidePosition:"Slide {page} / {total}",pdfSheetPosition:"Sheet {page} / {total}",pdfPageAlt:"Rendered PDF page {page} of {total}",pdfGoToPage:"Go to page {page}",previousPage:"Prev",nextPage:"Next",deckTitle:"Deck preview",deckMessage:"Converted PDF pages will replace this deck skeleton when a file endpoint is available.",sheetTitle:"Sheet preview",sheetMessage:"Dense PDF-like pages stay visible while generation runs.",failedTitle:"Run failed",failedMessage:"Any preserved source or logs remain available from the run folder.",runFolderPending:"Run folder pending",files:"Files",pageLabel:"Slide 1 / 12",htmlReport:"HTML report",generatedEssay:"Generated Essay",generatedSlidesSource:"Generated Slides",generatedSlides:"Course Presentation",introduction:"Introduction",argument:"Argument",references:"References",notebookApproach:"Approach",notebookApproachBody:"State the algorithm, edge cases, and complexity before the implementation cell.",markdown:"Markdown",code:"Code",notebookValidation:"Notebook validation",preservedForInspection:"Preserved for inspection",noExecution:"Preview-only, no execution",a4DenseLayout:"A4 dense layout",onePage:"{count} page",manyPages:"{count} pages",sourceTitle:"Source view",sourceMessage:"Shows generated source or a representative skeleton until backend artifact bytes are exposed.",logsTitle:"Run logs",logsMessage:"Shows live status now and sanitized run logs when they are available.",manifestTitle:"Manifest view",manifestMessage:"Shows the expected manifest shape before a real manifest is written."},files:{scriptReady:"script output",notebookReady:"notebook output",logReady:"run log",metadataReady:"metadata",pdfReady:"converted PDF",deckReady:"converted deck",sheetReady:"converted sheet",sourceReady:"source preserved",compileLogReady:"conversion log",pending:"pending",compilePending:"conversion pending"},source:{artifactNoteReady:"Artifact bytes are available through authenticated access.",artifactNotePending:"Run folder appears after a run is accepted by the backend.",artifactLoading:"Reading generated artifacts...",artifactLoaded:"Generated artifact content loaded.",artifactMetadataLoaded:"Generated manifest metadata loaded.",artifactLoadFailed:"Could not load generated artifacts.",artifactReadFailed:"Could not read this artifact safely.",noArtifactText:"No readable artifact text is available.",generationLog:"generation.log",notStarted:"not-started",status:"status",error:"error"},auth:{kicker:"Institutional auth",loginTitle:"Login",registerTitle:"Register",email:"Institutional email",password:"Password",confirmPassword:"Confirm password",contacting:"Contacting local backend...",failed:"Authentication failed.",expired:"Session expired",created:"Account created. Login is ready."},model:{settingsKicker:"Model settings",defaultName:"Qwen Default",defaultButton:"Default Qwen profile",needsAttention:"Model needs attention",displayName:"Display name",baseUrl:"Base URL",model:"Model",apiKey:"API key",newKey:"New key",savedKey:"Saved key configured",noSavedKey:"No saved key",environmentDefault:"environment-default",provider:"Provider",contextWindow:"Context window",streaming:"Streaming",streamingOn:"On",streamingOff:"Off",defaultsSummary:"Qwen non-secret defaults",defaultHelp:"The Qwen endpoint, model, context window, and streaming mode are already filled. Add only your API key to test or save.",savedLoaded:"Saved profile loaded.",defaultsLoaded:"Local defaults loaded.",loadFailed:"Model profile load failed.",saving:"Saving model profile.",saved:"Model profile saved.",saveFailed:"Model profile save failed.",testing:"Testing provider connection.",testFailed:"Provider connectivity test failed.",connectionOk:"Connection OK for {model}."},run:{ready:"Ready",required:"Required",addBrief:"Add a task brief before running.",preparingUploads:"Preparing reference uploads.",submitting:"Submitting run to local backend.",requestFailed:"Run request failed.",succeeded:"Run succeeded.",failed:"Run failed.",running:"Run is running.",queued:"Run queued.",refreshFailed:"Could not refresh run status.",statusRefreshFailed:"Run status refresh failed.",pathCopied:"Run folder path copied.",pathRevealCopied:"Run folder path copied for reveal.",artifactPathCopied:"Artifact path copied.",previewCopied:"Visible preview copied.",clipboardUnavailable:"Clipboard is not available in this browser context.",validationIssue:"Validation issue",artifactReady:"Artifact ready",generating:"Generating",rendererArmed:"Renderer armed",sourcePreserved:"source preserved if available",downloadOpenAvailable:"download/open available",downloadStarted:"Download started.",downloadFailed:"Download failed. Please sign in again or retry.",completed:"completed",syntaxPreview:"syntax preview, no execution"},status:{idle:"Idle",queued:"Queued",running:"Running",succeeded:"Succeeded",failed:"Failed",cancelled:"Cancelled"},stages:{compose:"Compose",choose_intent:"Select artifact",validate_request:"Validate",upload_inputs:"Upload inputs",submit_run:"Submit run",queued:"Queued",running:"Running",resolve_model:"Model",extract_context:"Context",decide_search:"Search",generate_source:"Generate",validate_source:"Validate",repair_source:"Repair source",compile_pdf:"Convert PDF",write_manifest:"Manifest",poll_status:"Refresh",output_files:"Output files",route:"Route",context:"Context",generate:"Generate",validate:"Validate",write:"Write",compile:"Convert",outline:"Outline",ingest:"Ingest",compress:"Compress",layout:"Layout"},context:{ok:"OK",warning:"Warning",critical:"Critical",local:"Local estimate",heuristic:"Backend heuristic",provider:"Provider estimate",input:"Input",output:"Output",total:"Total",limit:"Limit",use:"Use",warningLabel:"Warning",source:"Source",criticalSummary:"Aggressive compression likely",warningSummary:"Compression may be needed",ratioSummary:"{percent} of context",aria:"Context budget {state}, {percent} utilized, {source}"},errors:{required:"Required",absoluteHttpUrl:"Use an absolute http or https URL",enum:"Choose a supported value",invalid:"Invalid value"}},"zh-Hans":{app:{title:"AI Learning Assistant - 成果工作室",brand:"AI Learning Assistant",userFallback:"用户"},locale:{label:"界面语言"},mobile:{console:"控制台",preview:"预览"},pane:{consoleKicker:"生产控制台",previewKicker:"成果预览"},actions:{model:"模型",copyPath:"复制路径",reveal:"显示位置",regenerate:"重新生成",copy:"复制",download:"下载",open:"打开",runArtifact:"开始生成",runAgain:"再次运行",running:"运行中",newRevisionRun:"新修订运行",copyVisible:"复制当前",test:"测试",save:"保存",saving:"保存中",login:"登录",createAccount:"创建账户",closeModel:"关闭模型设置",removeFile:"移除 {name}"},intents:{code_homework:{label:"代码",short:"PY",title:"作业代码",description:"脚本或 Notebook 答案",primaryTab:"代码",sourceTab:"源文件"},essay_latex:{label:"论文",short:"HTML",title:"HTML 论文",description:"HTML 源文件与 PDF",primaryTab:"渲染",sourceTab:"HTML"},beamer_slides:{label:"幻灯",short:"PDF",title:"HTML 幻灯",description:"幻灯 HTML 与 PDF",primaryTab:"渲染",sourceTab:"HTML"},cheat_sheet:{label:"速查表",short:"A4",title:"密集 A4 速查表",description:"课程内容压缩 HTML 与 PDF",primaryTab:"渲染",sourceTab:"HTML"}},controls:{artifactType:"成果类型",search:"检索",searchMode:{auto:"自动",on:"开启",off:"关闭"},output:"输出",previewOnly:"仅预览",targetPages:"目标页数",a4:"A4",dense:"密集",pdfFirst:"HTML 预览优先",sourceKept:"保留源文件"},course:{label:"课程上下文",defaultTitle:"随便问问",contextDisabled:"不使用上下文",contextEnabled:"使用上下文",defaultNote:"用于一般任务，不会加入课程记忆。",contextNote:"本次运行可参考精简的课程记忆。",manage:"管理",done:"完成",loading:"正在载入课程……",unavailable:"课程暂不可用",newTitle:"新建课程",newPlaceholder:"例如：机器学习",selectedTitle:"所选课程名称",create:"创建",rename:"重命名",archive:"归档",defaultLocked:"默认课程始终可用，不能重命名或归档。",titleRequired:"请输入课程名称。",creating:"正在创建课程。",created:"课程已创建并选中。",createFailed:"创建课程失败。",renaming:"正在重命名课程。",renamed:"课程已重命名。",renameFailed:"重命名课程失败。",archiving:"正在归档课程。",archived:"课程已归档，历史运行仍可访问。",archiveFailed:"归档课程失败。",loadFailed:"无法载入课程列表。"},composer:{brief:"任务说明",briefPlaceholder:"粘贴作业要求、约束条件、评分期望与输出说明。",runNoteLogin:"登录后可使用生成控制。",runNoteBrief:"填写任务说明后即可生成。",runNoteUploads:"已选文件会在创建运行前上传。",runNoteRunning:"后端报告上下文与阶段事件后会同步更新。",runNoteReady:"已准备好创建本地生成运行。",progressLabel:"近似进度",progressNote:"此进度条仅用于等待时的节奏提示；实际状态以后端阶段为准。",progressAria:"近似生成进度"},uploads:{label:"参考文件",choose:"拖入或选择参考文件",selected:"已选择 {count} 个参考文件",selectedPlural:"已选择 {count} 个参考文件",willUpload:"文件将在下一次运行前上传。",duplicates:"这些文件已在选择列表中。",uploaded:"已上传",uploading:"上传中",failed:"上传失败",unavailable:"当前后端构建未提供上传 API。",failedGeneric:"上传失败。",missingIds:"上传响应未返回全部文件编号。"},refinement:{label:"后续修订",availableAfterRun:"首次运行后可用",revisionSource:"修订来源 {id}",placeholder:"要求证明更严谨、注释更充分、幻灯更少，或调整结构。",note:"将创建新的运行；生成文件仍以磁盘成果为准。",missing:"请先填写后续修订要求。"},history:{label:"运行记录",entries:"{count} 条记录",readyTitle:"控制台就绪",readyMessage:"请选择成果类型，补充材料后开始运行。",followUpTitle:"后续修订请求",regenerateTitle:"重新生成请求",generationTitle:"生成请求",runTitle:"运行 {id}",folderPending:"文件夹待生成"},preview:{tabs:{logs:"日志",manifest:"清单"},statusMessage:"运行状态",stageProgress:"阶段进度",currentStage:"当前：{stage}",emptyPdfTitle:"PDF 渲染器",emptyPdfMessage:"在成果文件可读取前，页面以 PDF 样式预览呈现。",htmlDocumentTitle:"HTML 预览",htmlLoading:"正在渲染 HTML",htmlLoadingMessage:"正在把认证 HTML 源文件载入沙盒预览。",htmlRendererError:"HTML 预览不可用",htmlRenderReady:"已根据生成的 HTML 成果渲染。",htmlFrameTitle:"生成 HTML 成果预览",pdfFallbackAvailable:"PDF 输出仍可检查。",pdfLoading:"正在渲染 PDF",pdfLoadingMessage:"正在读取认证成果文件，并绘制页面。",pdfRendererError:"PDF 预览不可用",pdfRenderReady:"已根据生成的 PDF 成果渲染。",pdfPagePosition:"第 {page} / {total} 页",pdfSlidePosition:"第 {page} / {total} 张",pdfSheetPosition:"第 {page} / {total} 页",pdfPageAlt:"已渲染 PDF 第 {page} / {total} 页",pdfGoToPage:"转到第 {page} 页",previousPage:"上一页",nextPage:"下一页",deckTitle:"幻灯预览",deckMessage:"文件端点可用后，已转换 PDF 页面会替换当前骨架。",sheetTitle:"速查表预览",sheetMessage:"生成期间保持密集 PDF 样式页面可见。",failedTitle:"运行失败",failedMessage:"如源文件或日志已保留，可继续从运行文件夹检查。",runFolderPending:"运行文件夹待生成",files:"文件",pageLabel:"第 1 / 12 页",htmlReport:"HTML 报告",generatedEssay:"生成论文",generatedSlidesSource:"生成幻灯",generatedSlides:"课程演示",introduction:"引言",argument:"论证",references:"参考文献",notebookApproach:"方法说明",notebookApproachBody:"先说明算法、边界情况与复杂度，再呈现实作单元。",markdown:"Markdown",code:"代码",notebookValidation:"Notebook 校验",preservedForInspection:"已保留供检查",noExecution:"仅预览，不执行",a4DenseLayout:"A4 密集版式",onePage:"{count} 页",manyPages:"{count} 页",sourceTitle:"源文件视图",sourceMessage:"在后端成果文件可读取前，显示生成源文件或相应骨架。",logsTitle:"运行日志",logsMessage:"先显示当前状态；日志可用后显示已清理的运行日志。",manifestTitle:"清单视图",manifestMessage:"真实清单写入前，先显示预计 manifest 结构。"},files:{scriptReady:"脚本输出",notebookReady:"Notebook 输出",logReady:"运行日志",metadataReady:"元数据",pdfReady:"已转换 PDF",deckReady:"已转换幻灯",sheetReady:"已转换速查表",sourceReady:"源文件已保留",compileLogReady:"转换日志",pending:"待生成",compilePending:"待转换"},source:{artifactNoteReady:"成果文件已可通过认证访问读取。",artifactNotePending:"后端接受运行后会生成运行文件夹。",artifactLoading:"正在读取生成成果...",artifactLoaded:"已载入生成成果内容。",artifactMetadataLoaded:"已载入生成清单元数据。",artifactLoadFailed:"无法载入生成成果。",artifactReadFailed:"无法安全读取此成果文件。",noArtifactText:"暂无可读取的成果文本。",generationLog:"generation.log",notStarted:"尚未开始",status:"状态",error:"错误"},auth:{kicker:"院校认证",loginTitle:"登录",registerTitle:"注册",email:"院校邮箱",password:"密码",confirmPassword:"确认密码",contacting:"正在联系本地后端...",failed:"认证失败。",expired:"会话已过期",created:"账户已创建，请登录。"},model:{settingsKicker:"模型设置",defaultName:"Qwen 默认配置",defaultButton:"默认 Qwen 配置",needsAttention:"模型需要处理",displayName:"显示名称",baseUrl:"Base URL",model:"模型",apiKey:"API key",newKey:"新密钥",savedKey:"已配置密钥",noSavedKey:"未保存密钥",environmentDefault:"环境默认配置",provider:"提供方",contextWindow:"上下文窗口",streaming:"流式输出",streamingOn:"开启",streamingOff:"关闭",defaultsSummary:"Qwen 非密钥默认值",defaultHelp:"Qwen 端点、模型、上下文窗口与流式模式已预填；只需填写 API key 即可测试或保存。",savedLoaded:"已载入保存配置。",defaultsLoaded:"已载入本地默认值。",loadFailed:"模型配置载入失败。",saving:"正在保存模型配置。",saved:"模型配置已保存。",saveFailed:"模型配置保存失败。",testing:"正在测试提供方连接。",testFailed:"提供方连接测试失败。",connectionOk:"{model} 连接正常。"},run:{ready:"就绪",required:"必填",addBrief:"请先填写任务说明。",preparingUploads:"正在准备参考文件上传。",submitting:"正在提交至本地后端。",requestFailed:"运行请求失败。",succeeded:"运行成功。",failed:"运行失败。",running:"运行正在进行。",queued:"运行已排队。",refreshFailed:"无法刷新运行状态。",statusRefreshFailed:"运行状态刷新失败。",pathCopied:"运行文件夹路径已复制。",pathRevealCopied:"运行文件夹路径已复制，可用于显示位置。",artifactPathCopied:"成果路径已复制。",previewCopied:"当前预览已复制。",clipboardUnavailable:"当前浏览器环境不可使用剪贴板。",validationIssue:"校验问题",artifactReady:"成果就绪",generating:"生成中",rendererArmed:"渲染器就绪",sourcePreserved:"可检查已保留源文件",downloadOpenAvailable:"可下载或打开文件",downloadStarted:"已开始下载。",downloadFailed:"下载失败，请重新登录或重试。",completed:"已完成",syntaxPreview:"语法预览，不执行"},status:{idle:"空闲",queued:"排队中",running:"运行中",succeeded:"成功",failed:"失败",cancelled:"已取消"},stages:{compose:"编写",choose_intent:"选择成果",validate_request:"校验",upload_inputs:"上传输入",submit_run:"提交运行",queued:"排队",running:"运行",resolve_model:"模型",extract_context:"上下文",decide_search:"检索",generate_source:"生成",validate_source:"校验",repair_source:"修复源文件",compile_pdf:"转换 PDF",write_manifest:"清单",poll_status:"刷新",output_files:"输出文件",route:"路由",context:"上下文",generate:"生成",validate:"校验",write:"写作",compile:"转换",outline:"提纲",ingest:"摄取",compress:"压缩",layout:"排版"},context:{ok:"正常",warning:"注意",critical:"紧张",local:"本地估算",heuristic:"后端估算",provider:"提供方估算",input:"输入",output:"输出",total:"合计",limit:"上限",use:"占用",warningLabel:"提示",source:"来源",criticalSummary:"可能需要强压缩",warningSummary:"可能需要压缩",ratioSummary:"占上下文 {percent}",aria:"上下文预算{state}，已占用 {percent}，{source}"},errors:{required:"必填",absoluteHttpUrl:"请使用完整 http 或 https URL",enum:"请选择受支持的值",invalid:"值无效"}},"zh-Hant":{app:{title:"AI Learning Assistant - 成果工作室",brand:"AI Learning Assistant",userFallback:"使用者"},locale:{label:"介面語言"},mobile:{console:"控制台",preview:"預覽"},pane:{consoleKicker:"生產控制台",previewKicker:"成果預覽"},actions:{model:"模型",copyPath:"複製路徑",reveal:"顯示位置",regenerate:"重新生成",copy:"複製",download:"下載",open:"開啟",runArtifact:"開始生成",runAgain:"再次執行",running:"執行中",newRevisionRun:"新修訂執行",copyVisible:"複製目前",test:"測試",save:"儲存",saving:"儲存中",login:"登入",createAccount:"建立帳戶",closeModel:"關閉模型設定",removeFile:"移除 {name}"},intents:{code_homework:{label:"程式",short:"PY",title:"作業程式",description:"腳本或 Notebook 答案",primaryTab:"程式",sourceTab:"原始檔"},essay_latex:{label:"論文",short:"HTML",title:"HTML 論文",description:"HTML 原始檔與 PDF",primaryTab:"渲染",sourceTab:"HTML"},beamer_slides:{label:"投影片",short:"PDF",title:"HTML 投影片",description:"投影片 HTML 與 PDF",primaryTab:"渲染",sourceTab:"HTML"},cheat_sheet:{label:"速查表",short:"A4",title:"密集 A4 速查表",description:"課程內容壓縮 HTML 與 PDF",primaryTab:"渲染",sourceTab:"HTML"}},controls:{artifactType:"成果類型",search:"檢索",searchMode:{auto:"自動",on:"開啟",off:"關閉"},output:"輸出",previewOnly:"僅預覽",targetPages:"目標頁數",a4:"A4",dense:"密集",pdfFirst:"HTML 預覽優先",sourceKept:"保留原始檔"},course:{label:"課程上下文",defaultTitle:"隨便問問",contextDisabled:"不使用上下文",contextEnabled:"使用上下文",defaultNote:"用於一般任務，不會加入課程記憶。",contextNote:"本次執行可參考精簡的課程記憶。",manage:"管理",done:"完成",loading:"正在載入課程……",unavailable:"課程暫不可用",newTitle:"新增課程",newPlaceholder:"例如：機器學習",selectedTitle:"所選課程名稱",create:"建立",rename:"重新命名",archive:"封存",defaultLocked:"預設課程始終可用，不能重新命名或封存。",titleRequired:"請輸入課程名稱。",creating:"正在建立課程。",created:"課程已建立並選取。",createFailed:"建立課程失敗。",renaming:"正在重新命名課程。",renamed:"課程已重新命名。",renameFailed:"重新命名課程失敗。",archiving:"正在封存課程。",archived:"課程已封存，歷史執行仍可存取。",archiveFailed:"封存課程失敗。",loadFailed:"無法載入課程清單。"},composer:{brief:"任務說明",briefPlaceholder:"貼上作業要求、限制條件、評分期望與輸出說明。",runNoteLogin:"登入後可使用生成控制。",runNoteBrief:"填寫任務說明後即可生成。",runNoteUploads:"已選文件會在建立執行前上傳。",runNoteRunning:"後端回報上下文與階段事件後會同步更新。",runNoteReady:"已準備好建立本地生成執行。",progressLabel:"近似進度",progressNote:"此進度條僅用於等待時的節奏提示；實際狀態以後端階段為準。",progressAria:"近似生成進度"},uploads:{label:"參考文件",choose:"拖入或選擇參考文件",selected:"已選擇 {count} 個參考文件",selectedPlural:"已選擇 {count} 個參考文件",willUpload:"文件將在下一次執行前上傳。",duplicates:"這些文件已在選擇列表中。",uploaded:"已上傳",uploading:"上傳中",failed:"上傳失敗",unavailable:"目前後端構建未提供上傳 API。",failedGeneric:"上傳失敗。",missingIds:"上傳回應未返回全部文件編號。"},refinement:{label:"後續修訂",availableAfterRun:"首次執行後可用",revisionSource:"修訂來源 {id}",placeholder:"要求證明更嚴謹、註釋更充分、投影片更少，或調整結構。",note:"將建立新的執行；生成文件仍以磁碟成果為準。",missing:"請先填寫後續修訂要求。"},history:{label:"執行記錄",entries:"{count} 條記錄",readyTitle:"控制台就緒",readyMessage:"請選擇成果類型，補充材料後開始執行。",followUpTitle:"後續修訂請求",regenerateTitle:"重新生成請求",generationTitle:"生成請求",runTitle:"執行 {id}",folderPending:"資料夾待生成"},preview:{tabs:{logs:"日誌",manifest:"清單"},statusMessage:"執行狀態",stageProgress:"階段進度",currentStage:"目前：{stage}",emptyPdfTitle:"PDF 渲染器",emptyPdfMessage:"在成果文件可讀取前，頁面以 PDF 樣式預覽呈現。",htmlDocumentTitle:"HTML 預覽",htmlLoading:"正在渲染 HTML",htmlLoadingMessage:"正在把認證 HTML 原始檔載入沙盒預覽。",htmlRendererError:"HTML 預覽不可用",htmlRenderReady:"已根據生成的 HTML 成果渲染。",htmlFrameTitle:"生成 HTML 成果預覽",pdfFallbackAvailable:"PDF 輸出仍可檢查。",pdfLoading:"正在渲染 PDF",pdfLoadingMessage:"正在讀取認證成果文件，並繪製頁面。",pdfRendererError:"PDF 預覽不可用",pdfRenderReady:"已根據生成的 PDF 成果渲染。",pdfPagePosition:"第 {page} / {total} 頁",pdfSlidePosition:"第 {page} / {total} 張",pdfSheetPosition:"第 {page} / {total} 頁",pdfPageAlt:"已渲染 PDF 第 {page} / {total} 頁",pdfGoToPage:"前往第 {page} 頁",previousPage:"上一頁",nextPage:"下一頁",deckTitle:"投影片預覽",deckMessage:"文件端點可用後，已轉換 PDF 頁面會替換目前骨架。",sheetTitle:"速查表預覽",sheetMessage:"生成期間保持密集 PDF 樣式頁面可見。",failedTitle:"執行失敗",failedMessage:"如原始檔或日誌已保留，可繼續從執行資料夾檢查。",runFolderPending:"執行資料夾待生成",files:"文件",pageLabel:"第 1 / 12 頁",htmlReport:"HTML 報告",generatedEssay:"生成論文",generatedSlidesSource:"生成投影片",generatedSlides:"課程演示",introduction:"引言",argument:"論證",references:"參考文獻",notebookApproach:"方法說明",notebookApproachBody:"先說明演算法、邊界情況與複雜度，再呈現實作單元。",markdown:"Markdown",code:"程式",notebookValidation:"Notebook 校驗",preservedForInspection:"已保留供檢查",noExecution:"僅預覽，不執行",a4DenseLayout:"A4 密集版式",onePage:"{count} 頁",manyPages:"{count} 頁",sourceTitle:"原始檔視圖",sourceMessage:"在後端成果文件可讀取前，顯示生成原始檔或相應骨架。",logsTitle:"執行日誌",logsMessage:"先顯示目前狀態；日誌可用後顯示已清理的執行日誌。",manifestTitle:"清單視圖",manifestMessage:"真實清單寫入前，先顯示預計 manifest 結構。"},files:{scriptReady:"腳本輸出",notebookReady:"Notebook 輸出",logReady:"執行日誌",metadataReady:"元資料",pdfReady:"已轉換 PDF",deckReady:"已轉換投影片",sheetReady:"已轉換速查表",sourceReady:"原始檔已保留",compileLogReady:"轉換日誌",pending:"待生成",compilePending:"待轉換"},source:{artifactNoteReady:"成果文件已可透過認證存取讀取。",artifactNotePending:"後端接受執行後會生成執行資料夾。",artifactLoading:"正在讀取生成成果...",artifactLoaded:"已載入生成成果內容。",artifactMetadataLoaded:"已載入生成清單元資料。",artifactLoadFailed:"無法載入生成成果。",artifactReadFailed:"無法安全讀取此成果文件。",noArtifactText:"暫無可讀取的成果文字。",generationLog:"generation.log",notStarted:"尚未開始",status:"狀態",error:"錯誤"},auth:{kicker:"院校認證",loginTitle:"登入",registerTitle:"註冊",email:"院校電郵",password:"密碼",confirmPassword:"確認密碼",contacting:"正在聯絡本地後端...",failed:"認證失敗。",expired:"會話已過期",created:"帳戶已建立，請登入。"},model:{settingsKicker:"模型設定",defaultName:"Qwen 預設配置",defaultButton:"預設 Qwen 配置",needsAttention:"模型需要處理",displayName:"顯示名稱",baseUrl:"Base URL",model:"模型",apiKey:"API key",newKey:"新密鑰",savedKey:"已配置密鑰",noSavedKey:"未儲存密鑰",environmentDefault:"環境預設配置",provider:"提供方",contextWindow:"上下文窗口",streaming:"串流輸出",streamingOn:"開啟",streamingOff:"關閉",defaultsSummary:"Qwen 非密鑰預設值",defaultHelp:"Qwen 端點、模型、上下文窗口與串流模式已預填；只需填寫 API key 即可測試或儲存。",savedLoaded:"已載入儲存配置。",defaultsLoaded:"已載入本地預設值。",loadFailed:"模型配置載入失敗。",saving:"正在儲存模型配置。",saved:"模型配置已儲存。",saveFailed:"模型配置儲存失敗。",testing:"正在測試提供方連線。",testFailed:"提供方連線測試失敗。",connectionOk:"{model} 連線正常。"},run:{ready:"就緒",required:"必填",addBrief:"請先填寫任務說明。",preparingUploads:"正在準備參考文件上傳。",submitting:"正在提交至本地後端。",requestFailed:"執行請求失敗。",succeeded:"執行成功。",failed:"執行失敗。",running:"執行正在進行。",queued:"執行已排隊。",refreshFailed:"無法刷新執行狀態。",statusRefreshFailed:"執行狀態刷新失敗。",pathCopied:"執行資料夾路徑已複製。",pathRevealCopied:"執行資料夾路徑已複製，可用於顯示位置。",artifactPathCopied:"成果路徑已複製。",previewCopied:"目前預覽已複製。",clipboardUnavailable:"目前瀏覽器環境不可使用剪貼簿。",validationIssue:"校驗問題",artifactReady:"成果就緒",generating:"生成中",rendererArmed:"渲染器就緒",sourcePreserved:"可檢查已保留原始檔",downloadOpenAvailable:"可下載或開啟檔案",downloadStarted:"已開始下載。",downloadFailed:"下載失敗，請重新登入或重試。",completed:"已完成",syntaxPreview:"語法預覽，不執行"},status:{idle:"閒置",queued:"排隊中",running:"執行中",succeeded:"成功",failed:"失敗",cancelled:"已取消"},stages:{compose:"撰寫",choose_intent:"選擇成果",validate_request:"校驗",upload_inputs:"上傳輸入",submit_run:"提交執行",queued:"排隊",running:"執行",resolve_model:"模型",extract_context:"上下文",decide_search:"檢索",generate_source:"生成",validate_source:"校驗",repair_source:"修復原始檔",compile_pdf:"轉換 PDF",write_manifest:"清單",poll_status:"刷新",output_files:"輸出文件",route:"路由",context:"上下文",generate:"生成",validate:"校驗",write:"寫作",compile:"轉換",outline:"提綱",ingest:"攝取",compress:"壓縮",layout:"排版"},context:{ok:"正常",warning:"注意",critical:"緊張",local:"本地估算",heuristic:"後端估算",provider:"提供方估算",input:"輸入",output:"輸出",total:"合計",limit:"上限",use:"佔用",warningLabel:"提示",source:"來源",criticalSummary:"可能需要強壓縮",warningSummary:"可能需要壓縮",ratioSummary:"佔上下文 {percent}",aria:"上下文預算{state}，已佔用 {percent}，{source}"},errors:{required:"必填",absoluteHttpUrl:"請使用完整 http 或 https URL",enum:"請選擇受支援的值",invalid:"值無效"}}},Bt="/ui/assets/context-budget-dial-critical-NHRAQxeA.png",Ot="/ui/assets/context-budget-dial-ok-CjS2UYST.png",Ht="/ui/assets/context-budget-dial-warning-D8umyfoM.png",qt="/ui/assets/auth-entry-preview-D2ClQ5ne.png",Ut="/ui/assets/empty-workbench-preview-B8cAaNFx.png",zt=Object.freeze(["code_homework","essay_latex","beamer_slides","cheat_sheet"]),jt=Object.freeze(["auto","on","off"]),Kt=".txt,.md,.py,.ipynb,.pdf,text/plain,text/markdown,text/x-python,application/json,application/pdf",E=Object.freeze({displayName:"Qwen Default",provider:"openai_compatible",baseUrl:"https://dashscope.aliyuncs.com/compatible-mode/v1",model:"qwen3.6-flash",contextWindowHint:1e6,supportsStreaming:!0});function Wt(e,a){const r={...e};return a.type==="selectIntent"&&(r.intent=le(a.intent),r.previewTab="primary",r.fieldErrors={},r.activeFile=be(r.outputPreference,r.activeFile)),a.type==="selectSearchMode"&&(r.searchMode=Ke(a.searchMode)),a.type==="selectOutputPreference"&&(r.outputPreference=We(a.outputPreference),r.activeFile=be(r.outputPreference,r.activeFile)),a.type==="setTargetPages"&&(r.targetPages=Ge(a.targetPages),r.fieldErrors={...r.fieldErrors||{}},delete r.fieldErrors.target_pages),r}function le(e){return zt.includes(e)?e:"code_homework"}function Ke(e){return jt.includes(e)?e:"auto"}function We(e){return e==="ipynb"?"ipynb":"py"}function Ge(e){const a=Number(e);return!Number.isFinite(a)||a<=0?1:Math.round(a)}function be(e,a){const r=e==="ipynb"?["solution.ipynb"]:["solution.py","tests.py","README.md"];return r.includes(a)?a:r[0]}function Gt({isAuthenticated:e,taskText:a,runStatus:r}){return!!(e&&String(a||"").trim()&&!w(r))}function w(e){return e==="queued"||e==="running"}function Vt(e,a){return le(e)==="code_homework"?We(a):"pdf"}function Jt(e,a){return le(e)!=="cheat_sheet"?{}:{target_pages:Ge(a),paper_size:"A4",density:"dense"}}function Qt({promptText:e,intent:a,outputPreference:r,searchMode:s,modelProfileId:l=null,courseId:o=null,uploadIds:d=[],targetPages:c=1,revisionOfRunId:p=null}){const h=le(a),m={task_text:String(e||""),intent:h,output_preference:Vt(h,r),search_mode:Ke(s),model_profile_id:l||null,course_id:o||null,upload_ids:Array.isArray(d)?d.filter(Boolean):[],options:Jt(h,c)};return p&&(m.revision_of_run_id=p),m}function Zt(e){return Array.isArray(e)?e.map(a=>({id:String(a?.id||""),title:String(a?.title||"").trim(),isDefault:!!a?.is_default,isArchived:!!a?.is_archived,contextEnabled:!!a?.context_enabled,contextUpdatedAt:a?.context_updated_at?String(a.context_updated_at):null})).filter(a=>a.id&&a.title&&!a.isArchived).sort((a,r)=>Number(r.isDefault)-Number(a.isDefault)):[]}function Pe(e,a){const r=Array.isArray(e)?e.filter(s=>!s.isArchived):[];return r.some(s=>s.id===a)?a:r.find(s=>s.isDefault)?.id||r[0]?.id||""}function Yt(e){return Array.isArray(e)?e.map(a=>({path:ea(a?.path),kind:String(a?.kind||""),mediaType:String(a?.media_type||""),sizeBytes:Number.isFinite(Number(a?.size_bytes))?Number(a.size_bytes):null,url:String(a?.url||"")})).filter(a=>a.path):[]}function x(e,a,{intent:r="code_homework",outputPreference:s="py",activeFile:l=""}={}){const o=Array.isArray(e)?e:[];return a==="manifest"?ta(o,"manifest","manifest.json"):a==="log"?W(o,aa(r))||o.find(d=>d.kind==="log"||d.path.startsWith("logs/"))||null:a==="source"?W(o,Oe(r,s,l))||o.find(d=>na().has(d.kind)&&we(d))||null:a==="primaryCode"?W(o,Ve(s,l))||o.find(d=>["script","notebook","source"].includes(d.kind)&&we(d))||null:a==="primaryPdf"?o.find(d=>d.kind==="pdf"||d.mediaType==="application/pdf")||null:a==="primaryHtml"&&(W(o,Oe(r,s,l))||o.find(d=>Xt(d)))||null}function de(e,a){const r=Number(e),s=Number(a),l=Number.isFinite(s)&&s>0?Math.floor(s):1;return!Number.isFinite(r)||r<=1?1:Math.min(Math.floor(r),l)}function we(e){const a=e?.mediaType||e?.media_type||"",r=e?.path||"";return!!(a.startsWith("text/")||a==="application/json"||r.endsWith(".json")||r.endsWith(".py")||r.endsWith(".ipynb")||r.endsWith(".md")||r.endsWith(".html")||r.endsWith(".htm")||r.endsWith(".log"))}function Xt(e){const a=e?.mediaType||e?.media_type||"",r=e?.path||"";return!!(a==="text/html"||a==="application/xhtml+xml"||r.endsWith(".html")||r.endsWith(".htm"))}function ea(e){return String(e||"").replace(/^\/+/u,"")}function ta(e,a,r){return e.find(s=>s.kind===a||s.path===r)||null}function W(e,a){const r=new Set(a.filter(Boolean));return e.find(s=>r.has(s.path))||null}function Ve(e,a){return e==="ipynb"?["output/solution.ipynb"]:[`output/${a||"solution.py"}`,"output/solution.py","solution.py"]}function Oe(e,a,r){return e==="code_homework"?Ve(a,r):e==="beamer_slides"?["output/slides.html","slides.html"]:e==="cheat_sheet"?["output/cheat-sheet.html","cheat-sheet.html"]:["output/main.html","main.html"]}function aa(e){return e==="code_homework"?["logs/generation.log","generation.log"]:["logs/convert.log","logs/generation.log","convert.log","generation.log"]}function na(){return new Set(["source","script","notebook"])}const y=window.__AI_LEARNING_ASSISTANT_API_URL||window.location.origin,ke="ai_learning_assistant_token",_e="ai_learning_assistant_user",Je="ai_learning_assistant_locale",te=E.contextWindowHint,ra=1200,ia=1120,ae=new Set(["succeeded","failed","cancelled"]),Te="en",ne={ok:Ot,warning:Ht,critical:Bt},ge=Wn(),g={displayName:E.displayName,provider:E.provider,baseUrl:E.baseUrl,model:E.model,contextWindowHint:E.contextWindowHint,supportsStreaming:E.supportsStreaming,apiKey:""},$e=[{id:"code_homework",outputs:["solution.py","solution.ipynb"],stages:["route","context","generate","validate"],accent:"clay"},{id:"essay_latex",outputs:["main.html","main.pdf"],stages:["route","context","write","compile"],accent:"sage"},{id:"beamer_slides",outputs:["slides.html","slides.pdf"],stages:["route","outline","write","compile"],accent:"amber"},{id:"cheat_sheet",outputs:["cheat-sheet.html","cheat-sheet.pdf"],stages:["ingest","compress","layout","compile"],accent:"coral"}],t={locale:ge,authMode:"login",token:localStorage.getItem(ke)||"",user:Qn(),activePane:"console",intent:"code_homework",outputPreference:"py",searchMode:"auto",targetPages:2,taskText:"",refinementText:"",files:[],fieldErrors:{},context:null,previewTab:"primary",activeFile:"solution.py",notice:{message:"",tone:"neutral"},course:Fe(),model:{editorOpen:!1,profiles:[],profile:null,form:{...g},fieldErrors:{},statusMessage:"",statusTone:"neutral",busy:""},authMessage:"",authTone:"neutral",run:se(ge),artifacts:C(),history:[Vn(ge)]},sa=document.getElementById("app");let Q=null,he=null;oa();function oa(){Tt(),P(),wn(),u(),t.token&&la()}async function la(){try{const e=await fetch(`${y}/api/auth/me`,{headers:{Authorization:`Bearer ${t.token}`}});if(!e.ok)throw new Error(n("auth.expired"));const a=await e.json();tt(a,t.token)}catch{at(),u()}}function u(){const e=!!(t.user&&t.token);Tt(),sa.innerHTML=`
        <div class="studio-app ${e?"":"is-auth-entry"}" data-mobile-pane="${i(t.activePane)}" lang="${i(t.locale)}">
            <main class="studio-main">
                ${e?`${da()}
                            <section class="workbench-grid" aria-label="${i(n("app.title"))}">
                                ${ca(e)}
                                ${$a(e)}
                            </section>`:va()}
                ${e&&t.model.editorOpen?Ha():""}
            </main>
        </div>
    `,Ua(),e&&ee()}function Qe(){return`
        <div class="locale-switch" role="group" aria-label="${i(n("locale.label"))}">
            ${je.map(e=>`
                <button
                    type="button"
                    class="${t.locale===e.id?"is-active":""}"
                    data-locale="${i(e.id)}"
                    title="${i(e.name)}"
                    aria-label="${i(e.name)}"
                >${i(e.label)}</button>
            `).join("")}
        </div>
    `}function da(){return`
        <nav class="mobile-pane-switch" aria-label="${i(n("app.title"))}">
            <button type="button" class="${t.activePane==="console"?"is-active":""}" data-pane="console">${i(n("mobile.console"))}</button>
            <button type="button" class="${t.activePane==="preview"?"is-active":""}" data-pane="preview">${i(n("mobile.preview"))}</button>
        </nav>
    `}function ca(e){return`
        <section class="console-pane workbench-pane" aria-label="${i(n("pane.consoleKicker"))}">
            <div class="pane-head">
                <div>
                    <div class="pane-kicker">${i(n("pane.consoleKicker"))}</div>
                </div>
                <div class="pane-actions">
                    ${Qe()}
                    <button class="tool-button" type="button" data-action="open-model-settings" ${e?"":"disabled"}>
                        <span class="tool-glyph" aria-hidden="true"></span>
                        <span>${i(Qa())}</span>
                    </button>
                    <button class="identity-chip" type="button" data-action="logout">
                        <span>${i(t.user?.email||n("app.userFallback"))}</span>
                        <strong>${i(t.user?.role||"")}</strong>
                    </button>
                </div>
            </div>

            ${ua()}

            <div class="console-utility-row">
                ${Oa()}
                ${fa()}
            </div>

            <div class="artifact-type-bar" role="radiogroup" aria-label="${i(n("controls.artifactType"))}">
                ${$e.map(pa).join("")}
            </div>

            <section class="command-composer" aria-label="${i(n("composer.brief"))}">
                <div class="composer-head">
                    <label class="field-label" for="task-text">${i(n("composer.brief"))}</label>
                    <span>${i(k(j().id,"description"))}</span>
                </div>
                <textarea
                    id="task-text"
                    class="task-input ${t.fieldErrors.task_text?"has-error":""}"
                    rows="8"
                    placeholder="${i(n("composer.briefPlaceholder"))}"
                >${i(t.taskText)}</textarea>
                ${t.fieldErrors.task_text?`<div class="field-error">${i(t.fieldErrors.task_text)}</div>`:""}
                ${ma()}
                ${ga()}
                <div class="composer-actions">
                    <button class="run-button" type="button" data-action="run" data-run-status="${i(t.run.status)}" ${Ee(e)?"":"disabled"}>
                        <span class="run-glyph" aria-hidden="true"></span>
                        <span data-run-button-label>${Pt()}</span>
                    </button>
                    ${kt(e)}
                </div>
            </section>

            ${ya(e)}
            ${ba()}
        </section>
    `}function ua(){const e=ue(),a=e&&!e.isDefault,r=t.course.loading||!t.course.items.length||w(t.run.status),s=!!(t.course.busy||w(t.run.status));return`
        <section class="course-control ${t.course.panelOpen?"is-open":""}" aria-label="${i(n("course.label"))}">
            <div class="course-select-row">
                <label class="course-select-field">
                    <span class="field-label">${i(n("course.label"))}</span>
                    <select data-course-select ${r?"disabled":""}>
                        ${t.course.items.length?t.course.items.map(l=>`
                                <option value="${i(l.id)}" ${l.id===t.course.selectedId?"selected":""}>
                                    ${i(He(l))}
                                </option>
                            `).join(""):`<option value="">${i(t.course.loading?n("course.loading"):n("course.unavailable"))}</option>`}
                    </select>
                </label>
                <div class="course-context-note">
                    <strong>${i(e?.isDefault?n("course.contextDisabled"):n("course.contextEnabled"))}</strong>
                    <span>${i(e?.isDefault?n("course.defaultNote"):n("course.contextNote"))}</span>
                </div>
                <button class="secondary-action course-manage-button" type="button" data-action="toggle-course-manager">
                    ${i(t.course.panelOpen?n("course.done"):n("course.manage"))}
                </button>
            </div>
            ${t.course.panelOpen?`
                <div class="course-manager">
                    <form class="course-create-form" data-course-form="create">
                        <label>
                            <span class="field-label">${i(n("course.newTitle"))}</span>
                            <input type="text" maxlength="200" data-course-create-title value="${i(t.course.createTitle)}" placeholder="${i(n("course.newPlaceholder"))}">
                        </label>
                        <button class="secondary-action" type="submit" ${s?"disabled":""}>${i(n("course.create"))}</button>
                    </form>
                    <div class="course-edit-row">
                        <label>
                            <span class="field-label">${i(n("course.selectedTitle"))}</span>
                            <input type="text" maxlength="200" data-course-rename-title value="${i(e?.isDefault?He(e):t.course.renameTitle)}" ${a?"":"disabled"}>
                        </label>
                        <button class="secondary-action" type="button" data-action="rename-course" ${a&&!s?"":"disabled"}>${i(n("course.rename"))}</button>
                        <button class="secondary-action is-danger" type="button" data-action="archive-course" ${a&&!s?"":"disabled"}>${i(n("course.archive"))}</button>
                    </div>
                    ${e?.isDefault?`<p class="course-default-lock">${i(n("course.defaultLocked"))}</p>`:""}
                    ${t.course.message?`<div class="inline-notice is-${i(t.course.tone)}">${i(t.course.message)}</div>`:""}
                </div>
            `:""}
        </section>
    `}function pa(e){const a=t.intent===e.id;return`
        <button
            type="button"
            class="artifact-type ${a?"is-active":""}"
            data-intent="${e.id}"
            data-accent="${e.accent}"
            role="radio"
            aria-checked="${a}"
        >
            <span class="artifact-short">${i(k(e.id,"short"))}</span>
            <span>
                <strong>${i(k(e.id,"label"))}</strong>
                <small>${i(k(e.id,"title"))}</small>
            </span>
        </button>
    `}function fa(){return`
        <div class="search-control">
            <span class="field-label">${i(n("controls.search"))}</span>
            <div class="segmented-control" data-control="search-mode">
                ${["auto","on","off"].map(e=>`
                    <button type="button" class="${t.searchMode===e?"is-active":""}" data-search-mode="${e}">
                        ${i(n(`controls.searchMode.${e}`))}
                    </button>
                `).join("")}
            </div>
        </div>
    `}function ma(){return t.intent==="code_homework"?`
            <div class="option-row">
                <div>
                    <span class="field-label">${i(n("controls.output"))}</span>
                    <div class="segmented-control is-tight" data-control="code-output">
                        <button type="button" class="${t.outputPreference==="py"?"is-active":""}" data-output-preference="py">.py</button>
                        <button type="button" class="${t.outputPreference==="ipynb"?"is-active":""}" data-output-preference="ipynb">.ipynb</button>
                    </div>
                </div>
                <div class="status-capsule">${i(n("controls.previewOnly"))}</div>
            </div>
        `:t.intent==="cheat_sheet"?`
            <div class="option-row">
                <label class="number-field">
                    <span class="field-label">${i(n("controls.targetPages"))}</span>
                    <input id="target-pages" class="${t.fieldErrors.target_pages?"has-error":""}" type="number" min="1" max="12" value="${t.targetPages}">
                </label>
                <div class="status-capsule">${i(n("controls.a4"))}</div>
                <div class="status-capsule">${i(n("controls.dense"))}</div>
            </div>
            ${t.fieldErrors.target_pages?`<div class="field-error">${i(t.fieldErrors.target_pages)}</div>`:""}
        `:`
        <div class="option-row">
            <div class="status-capsule">${i(n("controls.pdfFirst"))}</div>
            <div class="status-capsule">${i(n("controls.sourceKept"))}</div>
        </div>
    `}function ga(){const e=t.files.length?n(t.files.length===1?"uploads.selected":"uploads.selectedPlural",{count:t.files.length}):n("uploads.choose");return`
        <section class="upload-module" aria-label="${i(n("uploads.label"))}">
            <div class="upload-zone" data-action="open-file-picker" role="button" tabindex="0">
                <input id="file-input" type="file" multiple accept="${Kt}">
                <span class="upload-mark" aria-hidden="true"></span>
                <div>
                    <strong>${i(n("uploads.label"))}</strong>
                    <span>${i(e)}</span>
                </div>
            </div>
            ${t.files.length?ha():""}
            ${t.notice.message?`<div class="inline-notice is-${t.notice.tone}">${i(t.notice.message)}</div>`:""}
        </section>
    `}function ha(){return`
        <div class="selected-files">
            ${t.files.map(e=>`
                <div class="selected-file" data-file-key="${i(e.key)}">
                    <span class="file-kind">${i(Kn(e.name))}</span>
                    <span class="file-name">${i(e.name)}</span>
                    <small>${i(jn(e))}</small>
                    <button class="icon-action" type="button" data-remove-file="${i(e.key)}" aria-label="${i(n("actions.removeFile",{name:e.name}))}">x</button>
                </div>
            `).join("")}
        </div>
    `}function va(){return`
        <section class="auth-entry" aria-label="${i(n("auth.kicker"))}">
            <div class="auth-entry-shell">
                <div class="auth-entry-preview" aria-hidden="true">
                    <img src="${i(qt)}" alt="">
                    <div class="auth-preview-paper">
                        <span class="auth-preview-rule"></span>
                        <div class="auth-preview-brand">${i(n("app.brand"))}</div>
                        <i></i><i></i><i></i>
                    </div>
                </div>
                ${Ye()}
            </div>
        </section>
    `}function ya(e){const a=!e||!t.run.id||w(t.run.status);return`
        <section class="refinement-composer" aria-label="${i(n("refinement.label"))}">
            <div class="composer-head">
                <label class="field-label" for="refinement-text">${i(n("refinement.label"))}</label>
                <span>${i(t.run.id?n("refinement.revisionSource",{id:Rt(t.run.id)}):n("refinement.availableAfterRun"))}</span>
            </div>
            <textarea
                id="refinement-text"
                rows="3"
                placeholder="${i(n("refinement.placeholder"))}"
                ${a?"disabled":""}
            >${i(t.refinementText)}</textarea>
            <div class="composer-actions">
                <button class="secondary-action" type="button" data-action="run-refinement" ${a||!t.refinementText.trim()?"disabled":""}>
                    ${i(n("actions.newRevisionRun"))}
                </button>
                <span class="run-note" data-refinement-note>${i(n("refinement.note"))}</span>
            </div>
        </section>
    `}function ba(){return`
        <section class="history-stream" aria-label="${i(n("history.label"))}">
            <div class="history-head">
                <span>${i(n("history.label"))}</span>
                <small>${i(n("history.entries",{count:t.history.length}))}</small>
            </div>
            <div class="history-list">
                ${t.history.slice().reverse().map(wa).join("")}
            </div>
        </section>
    `}function wa(e){return`
        <article class="history-item is-${i(e.kind)}" data-status="${i(e.status||"idle")}">
            <div class="history-marker"></div>
            <div class="history-content">
                <div class="history-title">
                    <strong>${i(e.title)}</strong>
                    <span>${i(Xn(e.timestamp))}</span>
                </div>
                <p>${i(e.message)}</p>
                ${e.meta?`<div class="history-meta">${i(e.meta)}</div>`:""}
            </div>
        </article>
    `}function $a(e){const a=j();return`
        <section class="preview-pane workbench-pane" aria-label="${i(n("pane.previewKicker"))}">
            <div class="preview-header">
                <div>
                    <div class="pane-kicker">${i(n("pane.previewKicker"))}</div>
                    <h2>${i(k(a.id,"title"))}</h2>
                </div>
                <div class="preview-actions">
                    <button class="secondary-action" type="button" data-action="copy-current-path" ${t.run.outputRoot?"":"disabled"}>${i(n("actions.copyPath"))}</button>
                    <button class="secondary-action" type="button" data-action="reveal-run" ${t.run.outputRoot?"":"disabled"}>${i(n("actions.reveal"))}</button>
                    <button class="secondary-action" type="button" data-action="regenerate" ${Ee(e)?"":"disabled"}>${i(n("actions.regenerate"))}</button>
                </div>
            </div>

            <div class="preview-status-strip">
                ${Pa()}
                ${ka(a)}
            </div>

            <div class="preview-shell" data-intent="${i(t.intent)}" data-run-status="${i(t.run.status)}" style="--preview-empty-image: url('${i(Ut)}')">
                ${_a()}
                <div class="preview-body">
                    ${Ta()}
                </div>
            </div>

            ${Ia()}
        </section>
    `}function Pa(){return`
        <div class="run-status-pill" data-status="${i(t.run.status)}">
            <span class="status-light"></span>
            <div>
                <strong>${i(xt(t.run.status))}</strong>
                <span>${i(n("preview.currentStage",{stage:A(t.run.stage)}))}</span>
            </div>
        </div>
        <p class="run-message">${i(t.run.error||t.run.message)}</p>
    `}function ka(e){const a=zn(t.run.stage,t.run.status);return`
        <div class="stage-track-shell" aria-label="${i(n("preview.statusMessage"))}">
            <div class="stage-track-head">
                <span>${i(n("preview.stageProgress"))}</span>
                <small>${i(n("preview.currentStage",{stage:A(t.run.stage)}))}</small>
            </div>
            <div class="stage-track" role="list">
                ${e.stages.map((r,s)=>`
                    <span class="stage-step ${r===a?"is-active":""}" role="listitem" ${r===a?'aria-current="step"':""}>
                        <small>${s+1}</small>
                        <strong>${i(A(r))}</strong>
                    </span>
                `).join("")}
            </div>
        </div>
    `}function _a(){const e=Pn();return`
        <div class="preview-tabs" role="tablist" aria-label="${i(n("pane.previewKicker"))}">
            ${e.map(a=>`
                <button
                    type="button"
                    role="tab"
                    class="${t.previewTab===a.id?"is-active":""}"
                    data-preview-tab="${a.id}"
                    aria-selected="${t.previewTab===a.id}"
                >
                    ${i(a.label)}
                </button>
            `).join("")}
        </div>
    `}function Ta(){return t.previewTab==="source"?Ca():t.previewTab==="logs"?Na():t.previewTab==="manifest"?Da():t.intent==="code_homework"?xa():t.intent==="essay_latex"?Sa():t.intent==="beamer_slides"?Ra():Aa()}function xa(){return t.outputPreference==="ipynb"?La():`
        <div class="code-product">
            <div class="code-tabs">
                ${$n().map(a=>`
                    <button type="button" class="${t.activeFile===a?"is-active":""}" data-active-file="${i(a)}">
                        ${i(a)}
                    </button>
                `).join("")}
                <button class="copy-code-button" type="button" data-action="copy-visible-preview">${i(n("actions.copyVisible"))}</button>
            </div>
            <div class="code-editor" aria-label="${i(n("preview.code"))}">
                ${pe(Ne(t.activeFile),Rn(t.activeFile))}
            </div>
            <div class="terminal-strip" data-status="${i(t.run.status)}">
                <span>${i(qn())}</span>
                <strong>${i(Un())}</strong>
            </div>
        </div>
    `}function La(){const e=Ln();return`
        <div class="notebook-product">
            <div class="notebook-toolbar">
                <span>solution.ipynb</span>
                <button class="copy-code-button" type="button" data-action="copy-visible-preview">${i(n("actions.copyVisible"))}</button>
            </div>
            <div class="notebook-cell is-markdown">
                <span class="cell-label">${i(n("preview.markdown"))}</span>
                <h3>${i(e.title)}</h3>
                <p>${i(e.body)}</p>
            </div>
            <div class="notebook-cell">
                <span class="cell-label">${i(n("preview.code"))}</span>
                <div class="code-editor is-compact">${pe(e.code)}</div>
            </div>
            <div class="terminal-strip" data-status="${i(t.run.status)}">
                <span>${i(n("preview.notebookValidation"))}</span>
                <strong>${i(e.detail)}</strong>
            </div>
        </div>
    `}function Sa(){const e=xe("essay");if(e)return e;const a=Le("essay");return a||`
        <div class="pdf-stage">
            <div class="page-rail">
                <span class="is-active">1</span>
                <span>2</span>
                <span>3</span>
            </div>
            <article class="pdf-page essay-page">
                <header>
                    <span class="paper-overline">${i(n("preview.htmlReport"))}</span>
                    <h3>${i(D(n("preview.generatedEssay")))}</h3>
                    <div class="paper-rule"></div>
                </header>
                <section>
                    <h4>${i(n("preview.introduction"))}</h4>
                    <p></p><p class="short"></p>
                    <h4>${i(n("preview.argument"))}</h4>
                    <p></p><p></p><p class="shorter"></p>
                    <h4>${i(n("preview.references"))}</h4>
                    <p class="short"></p>
                </section>
            </article>
            ${Se(n("preview.emptyPdfTitle"),n("preview.emptyPdfMessage"))}
        </div>
    `}function Ra(){const e=xe("slides");if(e)return e;const a=Le("slides");return a||`
        <div class="slide-product">
            <aside class="slide-thumbs" aria-label="${i(n("preview.deckTitle"))}">
                <span class="is-active"></span>
                <span></span>
                <span></span>
                <span></span>
            </aside>
            <div class="slide-canvas">
                <div class="slide-page">
                    <span class="slide-kicker">${i(k("beamer_slides","title"))}</span>
                    <h3>${i(D(n("preview.generatedSlides")))}</h3>
                    <div class="slide-columns">
                        <span></span><span></span><span></span><span></span>
                    </div>
                    <div class="slide-footer">${i(n("preview.pageLabel"))}</div>
                </div>
            </div>
            ${Se(n("preview.deckTitle"),n("preview.deckMessage"))}
        </div>
    `}function Aa(){const e=xe("sheet");if(e)return e;const a=Le("sheet");if(a)return a;const r=Math.max(1,Math.round(Number(t.targetPages)||1));return`
        <div class="cheat-product">
            <div class="cheat-toolbar">
                <span>${i(n("preview.a4DenseLayout"))}</span>
                <strong>${i(n(r===1?"preview.onePage":"preview.manyPages",{count:r}))}</strong>
            </div>
            <div class="cheat-pages">
                ${Array.from({length:Math.min(r,4)},(s,l)=>`
                    <article class="cheat-page">
                        <header>
                            <span></span><span></span>
                        </header>
                        <div class="cheat-grid">
                            ${Array.from({length:36},(o,d)=>`
                                <i class="${(d+l)%7===0?"is-strong":""}"></i>
                            `).join("")}
                        </div>
                    </article>
                `).join("")}
            </div>
            ${Se(n("preview.sheetTitle"),n("preview.sheetMessage"))}
        </div>
    `}function xe(e){const a=x(t.artifacts.items,"primaryHtml",{intent:t.intent});if(!a)return"";const r=M(a.path),s=t.artifacts.errorsByPath[a.path]||"",l=t.artifacts.loading&&!r&&!s,o=e==="slides"?"preview.deckTitle":e==="sheet"?"preview.sheetTitle":"preview.htmlDocumentTitle";return`
        <div class="html-render-product ${e==="slides"?"is-slides":e==="sheet"?"is-sheet":"is-essay"}" data-html-path="${i(a.path)}">
            <div class="html-render-toolbar">
                <div>
                    <span>${i(n(o))}</span>
                    <strong>${i(_(a,"artifact.html"))}</strong>
                </div>
                <span>${i(n(s?"preview.preservedForInspection":"preview.htmlRenderReady"))}</span>
            </div>
            <div class="html-render-frame">
                ${r?`<iframe class="html-preview-frame" title="${i(n("preview.htmlFrameTitle"))}" sandbox="allow-same-origin" srcdoc="${i(r)}"></iframe>`:Ma(e)}
                ${l?re(n("preview.htmlLoading"),n("preview.htmlLoadingMessage"),"loading"):""}
                ${s?re(n("preview.htmlRendererError"),`${_(a,"artifact.html")}: ${s}`,"error"):""}
            </div>
            <div class="pdf-render-note">${i(n(s?"preview.pdfFallbackAvailable":"preview.htmlRenderReady"))}</div>
        </div>
    `}function Ma(e){return Z(e==="slides"?"slides":e==="sheet"?"sheet":"essay")}function Le(e){const a=x(t.artifacts.items,"primaryPdf",{intent:t.intent});if(!a)return"";const r=N(a.path),s=r.pageCount||0,l=de(r.currentPage||1,s||1),o=r.pages?.[l]||"",d=r.loading||t.artifacts.loading&&!o&&!r.error,c=e==="slides"?"preview.deckTitle":e==="sheet"?"preview.sheetTitle":"preview.emptyPdfTitle",h=n(e==="slides"?"preview.pdfSlidePosition":e==="sheet"?"preview.pdfSheetPosition":"preview.pdfPagePosition",{page:l,total:s||"?"}),m=n("preview.pdfPageAlt",{page:l,total:s||"?"});return`
        <div class="pdf-render-product is-${i(e)}" data-pdf-path="${i(a.path)}">
            <div class="pdf-render-toolbar">
                <div>
                    <span>${i(n(c))}</span>
                    <strong>${i(_(a,"artifact.pdf"))}</strong>
                </div>
                <div class="pdf-page-controls" aria-label="${i(h)}">
                    <button type="button" data-download-file="${i(a.path)}" ${t.token?"":"disabled"}>${i(n("actions.download"))}</button>
                    <button type="button" data-pdf-page-action="previous" data-pdf-path="${i(a.path)}" ${l<=1||d?"disabled":""}>${i(n("preview.previousPage"))}</button>
                    <span>${i(h)}</span>
                    <button type="button" data-pdf-page-action="next" data-pdf-path="${i(a.path)}" ${s&&l>=s||d?"disabled":""}>${i(n("preview.nextPage"))}</button>
                </div>
            </div>
            <div class="pdf-render-frame">
                ${Fa(e,l,s,a.path,d)}
                <figure class="pdf-render-surface">
                    ${o?`<img src="${i(o)}" alt="${i(m)}">`:Z(e)}
                    ${d?re(n("preview.pdfLoading"),n("preview.pdfLoadingMessage"),"loading"):""}
                    ${r.error?Ea(a,r.error):""}
                </figure>
            </div>
            <div class="pdf-render-note">${i(r.error?n("preview.preservedForInspection"):n("preview.pdfRenderReady"))}</div>
        </div>
    `}function Fa(e,a,r,s,l){const o=Math.max(1,Math.min(r||t.targetPages||1,e==="sheet"?4:8));return`
        <div class="pdf-render-rail" data-kind="${i(e)}">
            ${Array.from({length:o},(d,c)=>{const p=c+1;return`
                    <button
                        type="button"
                        class="${p===a?"is-active":""}"
                        data-pdf-page-action="go"
                        data-pdf-page="${p}"
                        data-pdf-path="${i(s)}"
                        ${l||r&&p>r?"disabled":""}
                        aria-label="${i(n("preview.pdfGoToPage",{page:p}))}"
                    >${p}</button>
                `}).join("")}
        </div>
    `}function Z(e){return e==="slides"?`
            <div class="slide-page is-pdf-placeholder">
                <span class="slide-kicker">${i(k("beamer_slides","title"))}</span>
                <h3>${i(D(n("preview.generatedSlides")))}</h3>
                <div class="slide-columns"><span></span><span></span><span></span><span></span></div>
            </div>
        `:e==="sheet"?`
            <article class="cheat-page is-pdf-placeholder">
                <header><span></span><span></span></header>
                <div class="cheat-grid">
                    ${Array.from({length:48},(a,r)=>`<i class="${r%7===0?"is-strong":""}"></i>`).join("")}
                </div>
            </article>
        `:`
        <article class="pdf-page essay-page is-pdf-placeholder">
            <header>
                <span class="paper-overline">${i(n("preview.htmlReport"))}</span>
                <h3>${i(D(n("preview.generatedEssay")))}</h3>
                <div class="paper-rule"></div>
            </header>
            <section>
                <h4>${i(n("preview.introduction"))}</h4>
                <p></p><p class="short"></p>
                <h4>${i(n("preview.argument"))}</h4>
                <p></p><p></p><p class="shorter"></p>
            </section>
        </article>
    `}function Ea(e,a){return re(n("preview.pdfRendererError"),`${_(e,"artifact.pdf")}: ${a}`,"error")}function re(e,a,r){return`
        <div class="preview-overlay is-${i(r)}">
            <strong>${i(e)}</strong>
            <span>${i(a)}</span>
        </div>
    `}function Se(e,a){return t.run.status==="succeeded"&&t.run.outputRoot?"":t.run.status==="failed"?`
            <div class="preview-overlay is-error">
                <strong>${i(t.run.errorCode||n("preview.failedTitle"))}</strong>
                <span>${i(t.run.error||n("preview.failedMessage"))}</span>
            </div>
        `:w(t.run.status)?`
            <div class="preview-overlay is-running">
                <strong>${i(A(t.run.stage))}</strong>
                <span>${i(t.run.message)}</span>
            </div>
        `:`
        <div class="preview-overlay">
            <strong>${i(e)}</strong>
            <span>${i(a)}</span>
        </div>
    `}function Ca(){const e=vt(),a=_(e.artifact,gt()),r=a.endsWith(".html")||a.endsWith(".htm")?"html":a.endsWith(".json")?"json":"python";return`
        <div class="inspection-product">
            ${Re(n("preview.sourceTitle"),e.message,e.tone)}
            <div class="inspection-head">
                <span>${i(a)}</span>
                <button class="copy-code-button" type="button" data-action="copy-visible-preview">${i(n("actions.copyVisible"))}</button>
            </div>
            <div class="code-editor">${pe(e.text,r)}</div>
            <div class="inspection-note">${i(fe())}</div>
        </div>
    `}function Na(){const e=yt();return`
        <div class="inspection-product">
            ${Re(n("preview.logsTitle"),e.message,e.tone)}
            <div class="inspection-head">
                <span>${i(_(e.artifact,n("source.generationLog")))}</span>
                <button class="copy-code-button" type="button" data-action="copy-visible-preview">${i(n("actions.copyVisible"))}</button>
            </div>
            <div class="log-view">
                ${Sn(e.text)}
            </div>
            <div class="inspection-note">${i(fe())}</div>
        </div>
    `}function Da(){const e=bt(),a=e.text||JSON.stringify(Ze(),null,2);return`
        <div class="inspection-product">
            ${Re(n("preview.manifestTitle"),e.message,e.tone)}
            <div class="inspection-head">
                <span>${i(_(e.artifact,"manifest.json"))}</span>
                <button class="copy-code-button" type="button" data-action="copy-visible-preview">${i(n("actions.copyVisible"))}</button>
            </div>
            <div class="code-editor">${pe(a,"json")}</div>
            <div class="inspection-note">${i(fe())}</div>
        </div>
    `}function Ze(){return{schema_version:1,run_id:t.run.id||null,revision_of_run_id:t.run.revisionOfRunId||null,intent:t.intent,search:{mode:t.searchMode},status:t.run.status,outputs:mt().map(e=>({path:e.relativePath,kind:e.kind}))}}function Re(e,a,r="neutral"){return`
        <div class="inspection-intro is-${i(r)}">
            <strong>${i(e)}</strong>
            <span>${i(a)}</span>
        </div>
    `}function Ia(){const e=kn();return`
        <section class="output-dock" aria-label="${i(n("preview.files"))}">
            <div class="output-head">
                <span>${i(n("preview.files"))}</span>
                <small>${t.run.outputRoot?i(At(t.run.outputRoot)):i(n("preview.runFolderPending"))}</small>
            </div>
            <div class="output-grid">
                ${e.map(a=>Ba(a)).join("")}
            </div>
        </section>
    `}function Ba(e){const a=On(e.relativePath),r=!!(e.artifact||t.run.outputRoot&&(t.run.status==="succeeded"||e.kind!=="pdf"));return`
        <div class="output-file" data-kind="${i(e.kind)}">
            <span class="file-kind">${i(e.badge)}</span>
            <div>
                <strong>${i(e.name)}</strong>
                <small>${i(r?e.readyLabel:e.pendingLabel)}</small>
            </div>
            <div class="file-actions">
                <button type="button" data-download-file="${i(e.relativePath)}" ${e.artifact&&t.token?"":"disabled"}>${i(n("actions.download"))}</button>
                <button type="button" data-open-file="${i(a||"")}" ${a?"":"disabled"}>${i(n("actions.open"))}</button>
            </div>
        </div>
    `}function Oa(){const e=ut();return`
        <div class="context-widget" tabindex="0" data-context-state="${i(e.warning_level)}" aria-label="${i(St(e))}">
            <div class="dial-ring" aria-hidden="true">
                <img src="${i(ne[e.warning_level]||ne.ok)}" alt="">
                <span data-context-field="state">${i(U(e.warning_level))}</span>
            </div>
            <div class="context-copy">
                <strong data-context-field="source-label">${i(z(e.source))}</strong>
                <span data-context-field="summary">${i(Lt(e))}</span>
            </div>
            <div class="context-popover" role="tooltip">
                <div><span>${i(n("context.input"))}</span><strong data-context-field="input">${T(e.estimated_input_tokens)}</strong></div>
                <div><span>${i(n("context.output"))}</span><strong data-context-field="output">${T(e.estimated_output_tokens)}</strong></div>
                <div><span>${i(n("context.total"))}</span><strong data-context-field="total">${T(e.estimated_total_tokens)}</strong></div>
                <div><span>${i(n("context.limit"))}</span><strong data-context-field="limit">${T(e.context_window_limit)}</strong></div>
                <div><span>${i(n("context.use"))}</span><strong data-context-field="utilization">${me(e.utilization_ratio)}</strong></div>
                <div><span>${i(n("context.warningLabel"))}</span><strong data-context-field="warning">${i(U(e.warning_level))}</strong></div>
                <div><span>${i(n("context.source"))}</span><strong data-context-field="source">${i(z(e.source))}</strong></div>
            </div>
        </div>
    `}function Ye(){return`
        <section class="auth-panel" aria-label="${i(n("auth.kicker"))}">
            <div class="auth-head">
                <div>
                    <div class="pane-kicker">${i(n("auth.kicker"))}</div>
                    <h2>${i(t.authMode==="login"?n("auth.loginTitle"):n("auth.registerTitle"))}</h2>
                </div>
                <div class="auth-head-actions">
                    ${Qe()}
                    <div class="auth-tabs">
                        <button type="button" class="${t.authMode==="login"?"is-active":""}" data-auth-mode="login">${i(n("actions.login"))}</button>
                        <button type="button" class="${t.authMode==="register"?"is-active":""}" data-auth-mode="register">${i(n("auth.registerTitle"))}</button>
                    </div>
                </div>
            </div>
            <form id="auth-form" class="auth-form" autocomplete="off">
                <label>
                    <span class="field-label">${i(n("auth.email"))}</span>
                    <input id="auth-email" type="email" autocomplete="off" autocapitalize="none" spellcheck="false">
                </label>
                <label>
                    <span class="field-label">${i(n("auth.password"))}</span>
                    <input id="auth-password" type="password" autocomplete="${t.authMode==="login"?"current-password":"new-password"}">
                </label>
                ${t.authMode==="register"?`<label>
                            <span class="field-label">${i(n("auth.confirmPassword"))}</span>
                            <input id="auth-confirm" type="password" autocomplete="new-password">
                        </label>`:""}
                <button class="run-button is-full" type="submit">${i(t.authMode==="login"?n("actions.login"):n("actions.createAccount"))}</button>
                <div class="inline-notice is-${t.authTone}">${i(t.authMessage)}</div>
            </form>
        </section>
    `}function Ha(){const e=t.model.form,a=t.model.profile,r=a?.api_key_ref?n("model.savedKey"):n("model.noSavedKey"),s=!!t.model.busy;return`
        <section class="model-modal" role="dialog" aria-modal="true" aria-label="${i(n("model.settingsKicker"))}">
            <div class="model-dialog">
                <div class="model-dialog-head">
                    <div>
                        <div class="pane-kicker">${i(n("model.settingsKicker"))}</div>
                        <h2>${i(e.displayName||n("model.defaultName"))}</h2>
                    </div>
                    <button class="icon-action is-large" type="button" data-action="close-model-settings" aria-label="${i(n("actions.closeModel"))}">x</button>
                </div>
                <form id="model-settings-form" class="model-form" novalidate>
                    <p class="model-helper">${i(n("model.defaultHelp"))}</p>
                    ${G("displayName",n("model.displayName"),"text",e.displayName,n("model.defaultName"),!1)}
                    ${G("baseUrl",n("model.baseUrl"),"url",e.baseUrl,g.baseUrl,!0)}
                    ${G("model",n("model.model"),"text",e.model,g.model,!0)}
                    ${qa(e)}
                    ${G("apiKey",n("model.apiKey"),"password",e.apiKey,a?.api_key_ref?n("model.newKey"):n("model.apiKey"),!1,"new-password")}
                    <div class="model-secret-row">
                        <span class="key-state ${a?.api_key_ref?"is-ready":""}">${i(r)}</span>
                        <span class="profile-id">${i(a?.id||n("model.environmentDefault"))}</span>
                    </div>
                    <div class="model-actions">
                        <button class="secondary-action" type="button" data-action="test-model-settings" ${s?"disabled":""}>${i(n("actions.test"))}</button>
                        <button class="run-button" type="submit" ${s?"disabled":""}>${i(t.model.busy==="save"?n("actions.saving"):n("actions.save"))}</button>
                    </div>
                    <div class="inline-notice is-${t.model.statusTone}">${i(t.model.statusMessage)}</div>
                </form>
            </div>
        </section>
    `}function qa(e){return`
        <div class="model-default-grid" aria-label="${i(n("model.defaultsSummary"))}">
            <div>
                <span>${i(n("model.provider"))}</span>
                <strong>${i(e.provider||g.provider)}</strong>
            </div>
            <div>
                <span>${i(n("model.contextWindow"))}</span>
                <strong>${i(T(e.contextWindowHint||g.contextWindowHint))}</strong>
            </div>
            <div>
                <span>${i(n("model.streaming"))}</span>
                <strong>${i(e.supportsStreaming?n("model.streamingOn"):n("model.streamingOff"))}</strong>
            </div>
        </div>
    `}function G(e,a,r,s,l,o,d="off"){const c=t.model.fieldErrors[e]||"";return`
        <label class="model-field ${c?"has-error":""}">
            <span class="field-label">${i(a)}</span>
            <input
                data-model-field="${e}"
                type="${r}"
                value="${i(s)}"
                placeholder="${i(l)}"
                autocomplete="${i(d)}"
                ${o?"required":""}
            >
            <span class="field-error">${i(c)}</span>
        </label>
    `}function Ua(){Xe(),et(),document.querySelectorAll("[data-pane]").forEach(a=>{a.addEventListener("click",()=>{t.activePane=a.dataset.pane,u()})}),document.getElementById("task-text")?.addEventListener("input",a=>{t.taskText=a.target.value,delete t.fieldErrors.task_text,a.target.classList.remove("has-error"),a.target.closest(".command-composer")?.querySelector(".field-error")?.remove(),P(),ee(),qe()}),document.getElementById("refinement-text")?.addEventListener("input",a=>{t.refinementText=a.target.value,P(),ee(),qe()}),document.querySelectorAll("button[data-intent]").forEach(a=>{a.addEventListener("click",()=>{V({type:"selectIntent",intent:a.dataset.intent}),P(),u()})}),document.querySelectorAll("[data-search-mode]").forEach(a=>{a.addEventListener("click",()=>{V({type:"selectSearchMode",searchMode:a.dataset.searchMode}),u()})}),document.querySelector("[data-course-select]")?.addEventListener("change",a=>{t.course.selectedId=Pe(t.course.items,a.target.value),ie(),t.course.message="",u()}),document.querySelector("[data-action='toggle-course-manager']")?.addEventListener("click",()=>{t.course.panelOpen=!t.course.panelOpen,t.course.message="",ie(),u()}),document.querySelector("[data-course-create-title]")?.addEventListener("input",a=>{t.course.createTitle=a.target.value}),document.querySelector("[data-course-rename-title]")?.addEventListener("input",a=>{t.course.renameTitle=a.target.value}),document.querySelector("[data-course-form='create']")?.addEventListener("submit",Wa),document.querySelector("[data-action='rename-course']")?.addEventListener("click",Ga),document.querySelector("[data-action='archive-course']")?.addEventListener("click",Va),document.querySelectorAll("[data-output-preference]").forEach(a=>{a.addEventListener("click",()=>{V({type:"selectOutputPreference",outputPreference:a.dataset.outputPreference}),P(),u()})}),document.getElementById("target-pages")?.addEventListener("input",a=>{V({type:"setTargetPages",targetPages:a.target.value}),P(),ee()});const e=document.querySelector("[data-action='open-file-picker']");e?.addEventListener("click",()=>document.getElementById("file-input")?.click()),e?.addEventListener("keydown",a=>{a.key!=="Enter"&&a.key!==" "||(a.preventDefault(),document.getElementById("file-input")?.click())}),document.getElementById("file-input")?.addEventListener("change",a=>{yn(Array.from(a.target.files||[])),u()}),document.querySelectorAll("[data-remove-file]").forEach(a=>{a.addEventListener("click",()=>{t.files=t.files.filter(r=>r.key!==a.dataset.removeFile),P(),u()})}),document.querySelector("[data-action='run']")?.addEventListener("click",()=>ve({isRevision:!1})),document.querySelector("[data-action='run-refinement']")?.addEventListener("click",()=>ve({isRevision:!0})),document.querySelector("[data-action='regenerate']")?.addEventListener("click",()=>ve({isRevision:!1,isRegenerate:!0})),document.querySelector("[data-action='logout']")?.addEventListener("click",()=>{H(),at(),u()}),document.querySelector("[data-action='open-model-settings']")?.addEventListener("click",Za),document.querySelector("[data-action='close-model-settings']")?.addEventListener("click",nt),document.getElementById("model-settings-form")?.addEventListener("submit",en),document.querySelector("[data-action='test-model-settings']")?.addEventListener("click",tn),document.querySelectorAll("[data-model-field]").forEach(a=>{a.addEventListener("input",()=>{t.model.form[a.dataset.modelField]=a.value,delete t.model.fieldErrors[a.dataset.modelField],a.closest(".model-field")?.classList.remove("has-error");const r=a.closest(".model-field")?.querySelector(".field-error");r&&(r.textContent="")})}),document.querySelector(".preview-tabs")?.addEventListener("click",a=>{const r=a.target.closest("[data-preview-tab]");r&&(t.previewTab=r.dataset.previewTab,u())}),document.querySelectorAll("[data-active-file]").forEach(a=>{a.addEventListener("click",()=>{t.activeFile=a.dataset.activeFile,u()})}),document.querySelectorAll("[data-pdf-page-action]").forEach(a=>{a.addEventListener("click",()=>{mn(a).catch(()=>{})})}),document.querySelector("[data-action='copy-visible-preview']")?.addEventListener("click",Nn),document.querySelector("[data-action='copy-current-path']")?.addEventListener("click",()=>De(t.run.outputRoot||"",n("run.pathCopied"))),document.querySelector("[data-action='reveal-run']")?.addEventListener("click",In),document.querySelectorAll("[data-download-file]").forEach(a=>{a.addEventListener("click",async()=>{const r=t.artifacts.items.find(s=>s.path===a.dataset.downloadFile);if(!(!r||!t.token||!t.run.id)){a.disabled=!0;try{await Dt(Ce(t.run.id,r),t.token,r.path),t.notice={message:n("run.downloadStarted"),tone:"success"}}catch{t.notice={message:n("run.downloadFailed"),tone:"error"}}u()}})}),document.querySelectorAll("[data-open-file]").forEach(a=>{a.addEventListener("click",()=>Bn(a.dataset.openFile||""))}),document.onkeydown=Ya}function V(e){Object.assign(t,Wt({intent:t.intent,previewTab:t.previewTab,fieldErrors:t.fieldErrors,activeFile:t.activeFile,outputPreference:t.outputPreference,searchMode:t.searchMode,targetPages:t.targetPages},e))}function Xe(e=document){e.querySelectorAll("[data-locale]").forEach(a=>{a.addEventListener("click",()=>{Gn(a.dataset.locale)})})}function et(e=document){e.querySelectorAll("[data-auth-mode]").forEach(a=>{a.addEventListener("click",()=>{za(a.dataset.authMode)})}),e.querySelector("#auth-form")?.addEventListener("submit",ja)}function za(e){t.authMode=e==="register"?"register":"login",t.authMessage="",t.authTone="neutral",Y()}function Y(){const e=document.querySelector(".auth-panel");if(!e){u();return}const r=document.createRange().createContextualFragment(Ye()).querySelector(".auth-panel");if(!r){u();return}e.replaceWith(r),Xe(r),et(r)}async function ja(e){e.preventDefault();const a=document.getElementById("auth-email")?.value.trim().toLowerCase()||"",r=document.getElementById("auth-password")?.value||"",s=document.getElementById("auth-confirm")?.value||"",l=t.authMode==="login"?"/api/auth/login":"/api/auth/register",o=t.authMode==="login"?{email:a,password:r}:{email:a,password:r,confirm_password:s};t.authMessage=n("auth.contacting"),t.authTone="neutral",Y();try{const d=await fetch(`${y}${l}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}),c=await d.json().catch(()=>({}));if(!d.ok)throw new Error(L(c,n("auth.failed")));if(t.authMode==="register"){t.authMode="login",t.authMessage=n("auth.created"),t.authTone="success",Y();return}tt({email:c.email,role:c.role},c.token)}catch(d){t.authMessage=f(d.message),t.authTone="error",Y()}}async function ve({isRevision:e,isRegenerate:a=!1}){if(!t.user||!t.token)return;const r=e?t.refinementText.trim():t.taskText.trim(),s=e?t.run.id:null;if(!r){t.fieldErrors.task_text=e?"":n("run.required"),t.run={...se(),status:"idle",stage:"validate_request",message:n(e?"refinement.missing":"run.addBrief")},u();return}H(),P(),t.fieldErrors={},t.notice={message:"",tone:"neutral"},t.run={...se(),status:"queued",stage:t.files.some(l=>!l.uploadId)?"upload_inputs":"submit_run",message:t.files.some(l=>!l.uploadId)?n("run.preparingUploads"):n("run.submitting"),revisionOfRunId:s},t.artifacts=C(),bn({kind:e?"revision":"command",status:"queued",title:n(e?"history.followUpTitle":a?"history.regenerateTitle":"history.generationTitle"),message:r,meta:`${k(j().id,"label")} / ${n("controls.search")} ${n(`controls.searchMode.${t.searchMode}`)}`}),t.activePane="preview",u();try{const l=await Ka();t.run={...t.run,stage:"submit_run",message:n("run.submitting")},u();const o=await fetch(`${y}/api/runs`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t.token}`},body:JSON.stringify(rn({promptText:r,uploadIds:l,revisionOfRunId:s}))}),d=await o.json().catch(()=>({}));if(!o.ok){sn(d,n("run.requestFailed")),u();return}ot(d),q(),e&&(t.refinementText=""),u();const c=d.id||d.run_id||t.run.id;c&&(ae.has(t.run.status)?await dt(c):await lt(c),ae.has(t.run.status)||un(c))}catch(l){t.run={...t.run,status:"failed",stage:t.run.stage||"submit_run",message:n("run.requestFailed"),error:f(l.message),errorCode:"frontend_request_failed"},q(),u()}}async function Ka(){const e=t.files.filter(o=>!o.uploadId);if(!e.length)return t.files.map(o=>o.uploadId).filter(Boolean);e.forEach(o=>{o.status="uploading"}),u();const a=new FormData;e.forEach(o=>a.append("files",o.file,o.name));const r=await fetch(`${y}/api/uploads`,{method:"POST",headers:{Authorization:`Bearer ${t.token}`},body:a}),s=await r.json().catch(()=>({}));if(!r.ok){e.forEach(d=>{d.status="failed"});const o=r.status===404?n("uploads.unavailable"):n("uploads.failedGeneric");throw new Error(L(s,o))}const l=Array.isArray(s.uploads)?s.uploads:[];if(e.forEach((o,d)=>{const c=l[d];o.uploadId=c?.id||"",o.status=o.uploadId?"uploaded":"failed"}),e.some(o=>!o.uploadId))throw new Error(n("uploads.missingIds"));return t.files.map(o=>o.uploadId).filter(Boolean)}async function ce({preserveSelection:e=!0}={}){if(!t.token)return;const a=e?t.course.selectedId:"";t.course.loading=!0,t.course.message="",u();try{const r=await fetch(`${y}/api/courses`,{headers:{Authorization:`Bearer ${t.token}`}}),s=await r.json().catch(()=>({}));if(!r.ok)throw new Error(L(s,n("course.loadFailed")));const l=Zt(s.courses);t.course.items=l,t.course.selectedId=Pe(l,a),t.course.tone="neutral",ie()}catch(r){t.course.items=[],t.course.selectedId="",t.course.message=f(r.message||n("course.loadFailed")),t.course.tone="error"}finally{t.course.loading=!1,u()}}async function Wa(e){e.preventDefault();const a=t.course.createTitle.trim();if(!a){b(n("course.titleRequired"),"error");return}t.course.busy="create",b(n("course.creating"),"neutral");try{const r=await Ae("/api/courses",{method:"POST",body:JSON.stringify({title:a})},n("course.createFailed"));t.course.createTitle="",await ce(),t.course.selectedId=Pe(t.course.items,r.id),ie(),b(n("course.created"),"success")}catch(r){b(r.message||n("course.createFailed"),"error")}finally{t.course.busy="",u()}}async function Ga(){const e=ue(),a=t.course.renameTitle.trim();if(!(!e||e.isDefault)){if(!a){b(n("course.titleRequired"),"error");return}t.course.busy="rename",b(n("course.renaming"),"neutral");try{await Ae(`/api/courses/${encodeURIComponent(e.id)}`,{method:"PATCH",body:JSON.stringify({title:a})},n("course.renameFailed")),await ce(),b(n("course.renamed"),"success")}catch(r){b(r.message||n("course.renameFailed"),"error")}finally{t.course.busy="",u()}}}async function Va(){const e=ue();if(!(!e||e.isDefault)){t.course.busy="archive",b(n("course.archiving"),"neutral");try{await Ae(`/api/courses/${encodeURIComponent(e.id)}`,{method:"PATCH",body:JSON.stringify({is_archived:!0})},n("course.archiveFailed")),await ce({preserveSelection:!1}),b(n("course.archived"),"success")}catch(a){b(a.message||n("course.archiveFailed"),"error")}finally{t.course.busy="",u()}}}async function Ae(e,a,r){const s=await fetch(`${y}${e}`,{...a,headers:{"Content-Type":"application/json",Authorization:`Bearer ${t.token}`,...a?.headers||{}}}),l=await s.json().catch(()=>({}));if(!s.ok)throw new Error(L(l,r));return l}function b(e,a){t.course.message=f(e),t.course.tone=a,u()}function ue(){return t.course.items.find(e=>e.id===t.course.selectedId)||t.course.items.find(e=>e.isDefault)||null}function ie(){t.course.renameTitle=ue()?.title||""}function He(e){return e.isDefault?n("course.defaultTitle"):e.title}function tt(e,a){t.user=e,t.token=a,localStorage.setItem(ke,a),localStorage.setItem(_e,JSON.stringify(e)),t.authMessage="",t.run=se(),t.artifacts=C(),t.course=Fe(),P(),u(),Xa(),ce()}function at(){Ja(),t.user=null,t.token="",t.artifacts=C(),t.course=Fe(),localStorage.removeItem(ke),localStorage.removeItem(_e)}function Ja(){t.model={editorOpen:!1,profiles:[],profile:null,form:{...g},fieldErrors:{},statusMessage:"",statusTone:"neutral",busy:""}}function Qa(){const e=t.model.profile;return e?.model?e.model:t.model.statusTone==="error"?n("model.needsAttention"):n("model.defaultButton")}function Za(){Me(),t.model.editorOpen=!0,t.model.statusMessage=t.model.profile?n("model.savedLoaded"):n("model.defaultsLoaded"),t.model.statusTone="neutral",t.model.fieldErrors={},u()}function nt(){t.model.editorOpen=!1,t.model.form.apiKey="",t.model.fieldErrors={},t.model.busy="",u()}function Ya(e){e.key==="Escape"&&t.model.editorOpen&&nt()}async function Xa(){if(t.token)try{const e=await fetch(`${y}/api/settings/model-profiles`,{headers:{Authorization:`Bearer ${t.token}`}}),a=await e.json().catch(()=>[]);if(!e.ok)throw new Error(L(a,n("model.loadFailed")));const r=Array.isArray(a)?a.map(rt):[];t.model.profiles=r,t.model.profile=r.find(s=>s.is_default)||r[0]||null,Me(),t.model.editorOpen&&(t.model.statusMessage=t.model.profile?n("model.savedLoaded"):n("model.defaultsLoaded"),t.model.statusTone="neutral"),u()}catch(e){t.model.statusMessage=f(e.message),t.model.statusTone="error",t.model.editorOpen&&u()}}function rt(e){return{id:String(e?.id||"default-qwen"),display_name:String(e?.display_name||n("model.defaultName")),provider:String(e?.provider||"openai_compatible"),base_url:String(e?.base_url||g.baseUrl),model:String(e?.model||g.model),api_key_ref:e?.api_key_ref?String(e.api_key_ref):null,context_window_hint:Number(e?.context_window_hint||g.contextWindowHint),supports_streaming:e?.supports_streaming===void 0?g.supportsStreaming:!!e.supports_streaming,is_default:!!e?.is_default}}function Me(){const e=t.model.profile;t.model.form={displayName:e?.display_name||n("model.defaultName"),provider:e?.provider||g.provider,baseUrl:e?.base_url||g.baseUrl,model:e?.model||g.model,contextWindowHint:Number(e?.context_window_hint||g.contextWindowHint),supportsStreaming:e?.supports_streaming===void 0?g.supportsStreaming:!!e.supports_streaming,apiKey:""}}async function en(e){e.preventDefault(),t.model.busy="save",t.model.statusMessage=n("model.saving"),t.model.statusTone="neutral",t.model.fieldErrors={},u();try{const a=await fetch(`${y}/api/settings/model-profiles/default`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t.token}`},body:JSON.stringify(it({includeApiKey:!0}))}),r=await a.json().catch(()=>({}));if(!a.ok){st(r,n("model.saveFailed"));return}t.model.profile=rt(r),t.model.profiles=[t.model.profile],Me(),t.model.statusMessage=n("model.saved"),t.model.statusTone="success",t.model.fieldErrors={}}catch(a){t.model.statusMessage=f(a.message),t.model.statusTone="error"}finally{t.model.busy="",t.model.form.apiKey="",u()}}async function tn(){t.model.busy="test",t.model.statusMessage=n("model.testing"),t.model.statusTone="neutral",t.model.fieldErrors={},u();try{const e=!!t.model.form.apiKey.trim(),a=await fetch(`${y}/api/settings/model-profiles/test`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t.token}`},body:JSON.stringify(e?it({includeApiKey:!0}):{})}),r=await a.json().catch(()=>({}));if(!a.ok){st(r,n("model.testFailed"));return}t.model.statusMessage=n("model.connectionOk",{model:r.model||t.model.form.model}),t.model.statusTone="success",t.model.fieldErrors={}}catch(e){t.model.statusMessage=f(e.message),t.model.statusTone="error"}finally{t.model.busy="",u()}}function it({includeApiKey:e}){const a=t.model.form,r={display_name:a.displayName.trim()||n("model.defaultName"),provider:a.provider||"openai_compatible",base_url:a.baseUrl.trim()||g.baseUrl,model:a.model.trim()||g.model,context_window_hint:Number(a.contextWindowHint||g.contextWindowHint),supports_streaming:!!(a.supportsStreaming??g.supportsStreaming)};return a.apiKey.trim()&&(r.api_key=a.apiKey.trim()),r}function st(e,a){const r=e?.error||{};t.model.statusMessage=r.code?`${r.code}: ${f(r.message||a)}`:L(e,a),t.model.statusTone="error",t.model.fieldErrors=an(r.fields||[])}function an(e){return e.reduce((a,r)=>{const s=nn(r.field);return s&&(a[s]=X(r.rule)),a},{})}function nn(e){return e==="base_url"?"baseUrl":e==="model"?"model":e==="api_key"?"apiKey":e==="display_name"?"displayName":""}function X(e){return e==="required"?n("errors.required"):e==="absolute_http_url"?n("errors.absoluteHttpUrl"):e==="enum"?n("errors.enum"):e||n("errors.invalid")}function se(e){const a=e||t.locale;return{id:"",status:"idle",stage:"compose",message:oe(a,"run.ready"),error:null,errorCode:"",outputRoot:"",revisionOfRunId:null}}function C(){return{runId:"",loading:!1,loaded:!1,error:"",items:[],manifest:null,textByPath:{},errorsByPath:{},pdfByPath:{}}}function Fe(){return{items:[],selectedId:"",panelOpen:!1,createTitle:"",renameTitle:"",loading:!1,busy:"",message:"",tone:"neutral"}}function rn({promptText:e,uploadIds:a,revisionOfRunId:r}){return Qt({promptText:e,uploadIds:a,revisionOfRunId:r,intent:t.intent,outputPreference:t.outputPreference,searchMode:t.searchMode,modelProfileId:t.model.profile?.id||null,courseId:t.course.selectedId||null,targetPages:t.targetPages})}function Ee(e){return Gt({isAuthenticated:e,taskText:t.taskText,runStatus:t.run.status})}function sn(e,a){const r=e?.error||{};t.fieldErrors=on(r.fields||[]),t.run={...t.run,status:"failed",stage:"submit_run",message:n("run.requestFailed"),error:L(e,a),errorCode:String(r.code||"request_failed")},q()}function on(e){return e.reduce((a,r)=>(r.field==="task_text"&&(a.task_text=X(r.rule)),r.field==="options.target_pages"&&(a.target_pages=X(r.rule)),r.field==="output_preference"&&(a.output_preference=X(r.rule)),a),{})}function ot(e){const a=e.id||e.run_id||t.run.id||"";a&&t.run.id&&a!==t.run.id&&(t.artifacts=C()),e.context&&(t.context=ft(e.context,"backend")),t.run={...t.run,id:a,status:e.status||t.run.status,stage:e.stage||t.run.stage||"queued",message:ln(e),error:dn(e),errorCode:cn(e),outputRoot:e.output_root||t.run.outputRoot||""},!ae.has(t.run.status)&&t.artifacts.runId&&(t.artifacts=C())}function ln(e){return e.message?f(e.message):e.error?.message?f(e.error.message):e.error_message?f(e.error_message):e.status==="succeeded"?n("run.succeeded"):e.status==="failed"?n("run.failed"):e.status==="running"?n("run.running"):n("run.queued")}function dn(e){return e.error?.message?f(e.error.message):e.status==="failed"&&e.error_message?f(e.error_message):null}function cn(e){return e.error?.code?String(e.error.code):e.status==="failed"&&typeof e.error_message=="string"?e.error_message.split(":")[0]||"run_failed":""}function un(e){H(),Q=window.setInterval(()=>{lt(e).catch(a=>{H(),t.run={...t.run,status:"failed",stage:"poll_status",message:n("run.refreshFailed"),error:f(a.message),errorCode:"status_refresh_failed"},q(),u()})},ra)}function H(){Q&&(window.clearInterval(Q),Q=null)}async function lt(e){if(!e||!t.token)return;const a=await fetch(`${y}/api/runs/${encodeURIComponent(e)}/events`,{headers:{Authorization:`Bearer ${t.token}`}}),r=await a.json().catch(()=>({}));if(!a.ok)throw new Error(L(r,n("run.statusRefreshFailed")));ot(r),q(),u(),ae.has(t.run.status)&&(H(),dt(e).catch(()=>{}))}async function dt(e){if(!(!e||!t.token)&&!(t.artifacts.runId===e&&(t.artifacts.loading||t.artifacts.loaded))){t.artifacts={...C(),runId:e,loading:!0},u();try{const a=await fetch(`${y}/api/runs/${encodeURIComponent(e)}/artifacts`,{headers:{Authorization:`Bearer ${t.token}`}}),r=await a.json().catch(()=>({}));if(!a.ok)throw new Error(L(r,n("source.artifactLoadFailed")));if(t.run.id!==e)return;const s=Yt(r.artifacts);if(t.artifacts={...t.artifacts,loading:!0,items:s,manifest:r.manifest&&typeof r.manifest=="object"?r.manifest:null,error:""},u(),await pn(e,s),await fn(e,s),t.run.id!==e)return;t.artifacts={...t.artifacts,loading:!1,loaded:!0},u()}catch(a){if(t.run.id!==e)return;t.artifacts={...t.artifacts,loading:!1,loaded:!1,error:f(a.message||n("source.artifactLoadFailed"))},u()}}}async function pn(e,a){const r=a.filter(o=>we(o)),s={},l={};await Promise.all(r.map(async o=>{try{const d=await fetch(Ce(e,o),{headers:{Authorization:`Bearer ${t.token}`}}),c=await d.text();if(!d.ok)throw new Error(f(c||n("source.artifactReadFailed")));s[o.path]=Zn(c)}catch(d){l[o.path]=f(d.message||n("source.artifactReadFailed"))}})),t.run.id===e&&(t.artifacts={...t.artifacts,textByPath:s,errorsByPath:l})}async function fn(e,a){const r=a.filter(s=>s.kind==="pdf"||s.mediaType==="application/pdf");r.length&&await Promise.all(r.map(async s=>{const l=N(s.path),o=de(l.currentPage||1,l.pageCount||1);await ct(e,s,o)}))}async function mn(e){const a=e.dataset.pdfPath||"",r=t.artifacts.items.find(c=>c.path===a);if(!r||!t.run.id)return;const s=N(a),l=s.pageCount||1;let o=s.currentPage||1;e.dataset.pdfPageAction==="previous"?o-=1:e.dataset.pdfPageAction==="next"?o+=1:o=Number(e.dataset.pdfPage||o),o=de(o,l);const d=!!s.pages?.[o];t.artifacts={...t.artifacts,pdfByPath:{...t.artifacts.pdfByPath,[a]:{...s,currentPage:o,loading:!d,error:d?s.error:""}}},u(),d||await ct(t.run.id,r,o)}async function ct(e,a,r){const s=a.path,l=N(s);t.artifacts={...t.artifacts,pdfByPath:{...t.artifacts.pdfByPath,[s]:{...l,currentPage:r,loading:!0,error:""}}},u();try{const o=await gn(e,a,r);if(t.run.id!==e)return;const d=N(s);t.artifacts={...t.artifacts,pdfByPath:{...t.artifacts.pdfByPath,[s]:{...d,loading:!1,error:"",pageCount:o.pageCount,currentPage:o.pageNumber,pages:{...d.pages||{},[o.pageNumber]:o.dataUrl},width:o.width,height:o.height}}},u()}catch(o){if(t.run.id!==e)return;const d=N(s);t.artifacts={...t.artifacts,pdfByPath:{...t.artifacts.pdfByPath,[s]:{...d,loading:!1,error:f(o.message||n("preview.pdfRendererError")),currentPage:r,pages:d.pages||{}}}},u()}}async function gn(e,a,r){const s=await fetch(Ce(e,a),{headers:{Authorization:`Bearer ${t.token}`}});if(!s.ok){const Ft=await s.text().catch(()=>"");throw new Error(f(Ft||n("source.artifactReadFailed")))}const l=await s.arrayBuffer(),c=await(await hn()).getDocument({data:new Uint8Array(l)}).promise,p=c.numPages,h=de(r,p),m=await c.getPage(h),S=m.getViewport({scale:1}),F=Math.min(2,ia/Math.max(1,S.width)),v=m.getViewport({scale:F}),R=document.createElement("canvas"),K=R.getContext("2d",{alpha:!1});if(!K)throw new Error(n("preview.pdfRendererError"));R.width=Math.ceil(v.width),R.height=Math.ceil(v.height),await m.render({canvasContext:K,viewport:v}).promise;const Mt=R.toDataURL("image/png");return await c.destroy(),{dataUrl:Mt,pageCount:p,pageNumber:h,width:R.width,height:R.height}}async function hn(){return he||(he=Nt(()=>import("./pdf-CkIk37Ba.js"),[]).then(e=>(e.GlobalWorkerOptions.workerSrc=It,e))),he}function Ce(e,a){const r=a.url||`/api/runs/${encodeURIComponent(e)}/artifacts/files/${a.path.split("/").map(encodeURIComponent).join("/")}`;return r.startsWith("http://")||r.startsWith("https://")?r:`${y}${r}`}function ee(){const e=ut(),a=document.querySelector(".dial-ring"),r=document.querySelector(".context-widget");if(!a||!r)return;a.style.setProperty("--context-ratio",`${Math.min(100,e.utilization_ratio*100)}%`);const s=a.querySelector("img");s&&(s.src=ne[e.warning_level]||ne.ok),r.dataset.contextState=e.warning_level,r.setAttribute("aria-label",St(e)),$("state",U(e.warning_level)),$("source-label",z(e.source)),$("summary",Lt(e)),$("input",T(e.estimated_input_tokens)),$("output",T(e.estimated_output_tokens)),$("total",T(e.estimated_total_tokens)),$("limit",T(e.context_window_limit)),$("utilization",me(e.utilization_ratio)),$("warning",U(e.warning_level)),$("source",z(e.source))}function qe(){const e=!!(t.user&&t.token),a=document.querySelector("[data-action='run']");if(a){a.disabled=!Ee(e),a.dataset.runStatus=t.run.status;const o=a.querySelector("[data-run-button-label]");o&&(o.textContent=Pt())}const r=document.querySelector("[data-run-note-shell]");r&&(r.outerHTML=kt(e));const s=!e||!t.run.id||w(t.run.status),l=document.querySelector("[data-action='run-refinement']");l&&(l.disabled=s||!t.refinementText.trim())}function $(e,a){document.querySelectorAll(`[data-context-field="${e}"]`).forEach(r=>{r.textContent=a})}function P(){t.context=pt()}function ut(){return t.context||pt()}function pt(){const e=j(),a=t.files.reduce((p,h)=>p+Number(h.size||0),0),r=`${t.taskText}
${t.refinementText}`.trim(),s=Math.max(1,Math.ceil((r.length+Math.min(a,2e5))/4)),l=e.id==="cheat_sheet"?Math.max(5e3,t.targetPages*1800):e.id==="beamer_slides"?7e3:e.id==="essay_latex"?6e3:t.outputPreference==="ipynb"?5200:4e3,o=s+l,d=o/te;let c="ok";return d>.85?c="critical":d>=.7&&(c="warning"),ft({estimated_input_tokens:s,estimated_output_tokens:l,estimated_total_tokens:o,context_window_limit:te,utilization_ratio:d,warning_level:c,source:"local"},"local")}function ft(e,a){const r=O(e?.estimated_input_tokens,0),s=O(e?.estimated_output_tokens,0),l=O(e?.context_window_limit,te)||te,o=O(e?.estimated_total_tokens,r+s),d=O(e?.utilization_ratio,l?o/l:0),c=vn(e?.warning_level,d);return{estimated_input_tokens:r,estimated_output_tokens:s,estimated_total_tokens:o,context_window_limit:l,utilization_ratio:d,warning_level:c,source:String(e?.source||a||"local")}}function O(e,a){const r=Number(e);return!Number.isFinite(r)||r<0?a:r}function vn(e,a){return e==="ok"||e==="warning"||e==="critical"?e:a>.85?"critical":a>=.7?"warning":"ok"}function yn(e){const a=new Set(t.files.map(s=>s.key)),r=e.map(s=>({key:`${s.name}-${s.size}-${s.lastModified}`,file:s,name:s.name,size:s.size,status:"pending",uploadId:""})).filter(s=>!a.has(s.key));t.files=[...t.files,...r],t.notice=r.length?{message:n("uploads.willUpload"),tone:"neutral"}:{message:n("uploads.duplicates"),tone:"neutral"},P()}function bn(e){t.history.push({id:`${Date.now()}-${Math.random().toString(16).slice(2)}`,timestamp:new Date().toISOString(),...e})}function q(){if(!t.run.id)return;const e=`run-${t.run.id}`,a=t.history.find(s=>s.id===e),r={id:e,kind:"run",status:t.run.status,title:n("history.runTitle",{id:Rt(t.run.id)}),message:t.run.error||t.run.message,meta:`${A(t.run.stage)} / ${t.run.outputRoot?At(t.run.outputRoot):n("history.folderPending")}`,timestamp:new Date().toISOString()};a?Object.assign(a,r):t.history.push(r)}function j(){return $e.find(e=>e.id===t.intent)||$e[0]}function wn(){t.activeFile=be(t.outputPreference,t.activeFile)}function $n(){return t.outputPreference==="ipynb"?["solution.ipynb"]:["solution.py","tests.py","README.md"]}function Pn(){return[{id:"primary",label:k(t.intent,"primaryTab")},{id:"source",label:k(t.intent,"sourceTab")},{id:"logs",label:n("preview.tabs.logs")},{id:"manifest",label:n("preview.tabs.manifest")}]}function mt(){return t.intent==="code_homework"?[t.outputPreference==="ipynb"?{name:"solution.ipynb",relativePath:"output/solution.ipynb",kind:"notebook",badge:"NB",readyLabel:n("files.notebookReady"),pendingLabel:n("files.pending")}:{name:"solution.py",relativePath:"output/solution.py",kind:"script",badge:"PY",readyLabel:n("files.scriptReady"),pendingLabel:n("files.pending")},{name:"generation.log",relativePath:"logs/generation.log",kind:"log",badge:"LOG",readyLabel:n("files.logReady"),pendingLabel:n("files.pending")},{name:"manifest.json",relativePath:"manifest.json",kind:"manifest",badge:"JS",readyLabel:n("files.metadataReady"),pendingLabel:n("files.pending")}]:t.intent==="essay_latex"?[{name:"main.html",relativePath:"output/main.html",kind:"source",badge:"HTML",readyLabel:n("files.sourceReady"),pendingLabel:n("files.pending")},{name:"main.pdf",relativePath:"output/main.pdf",kind:"pdf",badge:"PDF",readyLabel:n("files.pdfReady"),pendingLabel:n("files.compilePending")},{name:"convert.log",relativePath:"logs/convert.log",kind:"log",badge:"LOG",readyLabel:n("files.compileLogReady"),pendingLabel:n("files.pending")},{name:"manifest.json",relativePath:"manifest.json",kind:"manifest",badge:"JS",readyLabel:n("files.metadataReady"),pendingLabel:n("files.pending")}]:t.intent==="beamer_slides"?[{name:"slides.html",relativePath:"output/slides.html",kind:"source",badge:"HTML",readyLabel:n("files.sourceReady"),pendingLabel:n("files.pending")},{name:"slides.pdf",relativePath:"output/slides.pdf",kind:"pdf",badge:"PDF",readyLabel:n("files.deckReady"),pendingLabel:n("files.compilePending")},{name:"convert.log",relativePath:"logs/convert.log",kind:"log",badge:"LOG",readyLabel:n("files.compileLogReady"),pendingLabel:n("files.pending")},{name:"manifest.json",relativePath:"manifest.json",kind:"manifest",badge:"JS",readyLabel:n("files.metadataReady"),pendingLabel:n("files.pending")}]:[{name:"cheat-sheet.html",relativePath:"output/cheat-sheet.html",kind:"source",badge:"HTML",readyLabel:n("files.sourceReady"),pendingLabel:n("files.pending")},{name:"cheat-sheet.pdf",relativePath:"output/cheat-sheet.pdf",kind:"pdf",badge:"PDF",readyLabel:n("files.sheetReady"),pendingLabel:n("files.compilePending")},{name:"convert.log",relativePath:"logs/convert.log",kind:"log",badge:"LOG",readyLabel:n("files.compileLogReady"),pendingLabel:n("files.pending")},{name:"manifest.json",relativePath:"manifest.json",kind:"manifest",badge:"JS",readyLabel:n("files.metadataReady"),pendingLabel:n("files.pending")}]}function kn(){const e=mt(),a=new Map(t.artifacts.items.map(s=>[s.path,s])),r=e.map(s=>{const l=a.get(s.relativePath);return l?{...s,artifact:l,kind:l.kind||s.kind}:s});for(const s of t.artifacts.items)r.some(l=>l.relativePath===s.path)||s.path.startsWith("input/")||r.push(_n(s));return r}function _n(e){const a=_(e,e.path),r=a.split(".").pop()?.slice(0,3).toUpperCase()||"OUT";return{name:a,relativePath:e.path,kind:e.kind||"artifact",badge:r,readyLabel:Tn(e),pendingLabel:n("files.pending"),artifact:e}}function Tn(e){return e.kind==="pdf"?n("files.pdfReady"):e.kind==="log"?n("files.logReady"):e.kind==="manifest"?n("files.metadataReady"):e.kind==="notebook"?n("files.notebookReady"):e.kind==="script"?n("files.scriptReady"):n("files.sourceReady")}function gt(){return t.intent==="code_homework"?t.outputPreference==="ipynb"?"solution.ipynb":"solution.py":t.intent==="beamer_slides"?"slides.html":t.intent==="cheat_sheet"?"cheat-sheet.html":"main.html"}function Ne(e){const a=x(t.artifacts.items,"primaryCode",{intent:t.intent,outputPreference:t.outputPreference,activeFile:e}),r=a?M(a.path):"";return r||(a&&I(a.path)?B(a):t.artifacts.loading&&t.run.id?n("source.artifactLoading"):e==="tests.py"?`from solution import solve


def test_sample_case():
    assert solve([2, 4, 6]) == 12
`:e==="README.md"?`# Solution Notes

- Parse the assignment input explicitly.
- Keep edge cases near the solver.
- Include complexity in the final answer.
`:`from __future__ import annotations


def solve(values: list[int]) -> int:
    """Return the requested aggregate for the homework task."""
    total = 0
    for value in values:
        if value < 0:
            continue
        total += value
    return total


if __name__ == "__main__":
    print(solve([1, 2, 3]))
`)}function ht(){const e=x(t.artifacts.items,"primaryCode",{intent:t.intent,outputPreference:"ipynb",activeFile:"solution.ipynb"}),a=e?M(e.path):"";return a?wt(a):e&&I(e.path)?B(e):t.artifacts.loading&&t.run.id?n("source.artifactLoading"):`def solve(values):
    total = 0
    for value in values:
        total += value
    return total

solve([1, 2, 3])`}function xn(){return vt().text}function vt(){const e=x(t.artifacts.items,"source",{intent:t.intent,outputPreference:t.outputPreference,activeFile:gt()}),a=e?M(e.path):"";return a?{artifact:e,text:a,message:n("source.artifactLoaded"),tone:"success"}:e&&I(e.path)?{artifact:e,text:B(e),message:n("source.artifactReadFailed"),tone:"error"}:t.artifacts.loading&&t.run.id?{artifact:e,text:n("source.artifactLoading"),message:n("source.artifactLoading"),tone:"loading"}:t.artifacts.error?{artifact:null,text:Ue(),message:t.artifacts.error,tone:"error"}:{artifact:null,text:Ue(),message:n("preview.sourceMessage"),tone:"neutral"}}function yt(){const e=x(t.artifacts.items,"log",{intent:t.intent}),a=e?M(e.path):"";return a?{artifact:e,text:a,message:n("source.artifactLoaded"),tone:"success"}:e&&I(e.path)?{artifact:e,text:B(e),message:n("source.artifactReadFailed"),tone:"error"}:t.artifacts.loading&&t.run.id?{artifact:e,text:ye(),message:n("source.artifactLoading"),tone:"loading"}:t.artifacts.error?{artifact:null,text:ye(),message:t.artifacts.error,tone:"error"}:{artifact:null,text:ye(),message:n("preview.logsMessage"),tone:"neutral"}}function bt(){const e=x(t.artifacts.items,"manifest"),a=e?M(e.path):"";return a?{artifact:e,text:a,message:n("source.artifactLoaded"),tone:"success"}:e&&I(e.path)?{artifact:e,text:B(e),message:n("source.artifactReadFailed"),tone:"error"}:t.artifacts.manifest?{artifact:e,text:JSON.stringify(t.artifacts.manifest,null,2),message:n("source.artifactMetadataLoaded"),tone:"success"}:t.artifacts.loading&&t.run.id?{artifact:e,text:"",message:n("source.artifactLoading"),tone:"loading"}:t.artifacts.error?{artifact:null,text:"",message:t.artifacts.error,tone:"error"}:{artifact:null,text:"",message:n("preview.manifestMessage"),tone:"neutral"}}function Ln(){const e=x(t.artifacts.items,"primaryCode",{intent:t.intent,outputPreference:"ipynb",activeFile:"solution.ipynb"}),a=e?M(e.path):"";return a?{title:_(e,"solution.ipynb"),body:An(a),code:wt(a),detail:n("source.artifactLoaded")}:e&&I(e.path)?{title:_(e,"solution.ipynb"),body:n("source.artifactReadFailed"),code:B(e),detail:n("preview.preservedForInspection")}:{title:n("preview.notebookApproach"),body:n("preview.notebookApproachBody"),code:ht(),detail:t.run.status==="failed"?n("preview.preservedForInspection"):n("preview.noExecution")}}function Ue(){return t.intent==="code_homework"?Ne("solution.py"):t.intent==="beamer_slides"?`<!doctype html>
<html lang="${t.locale}">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: 10in 5.625in; margin: 0; }
    .slide { width: 960px; height: 540px; page-break-after: always; }
  </style>
</head>
<body>
  <section class="slide">
    <h1>${J(D(n("preview.generatedSlidesSource")))}</h1>
    <ul><li>Motivation</li><li>Method</li><li>Result</li></ul>
  </section>
</body>
</html>
`:t.intent==="cheat_sheet"?`<!doctype html>
<html lang="${t.locale}">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 8mm; }
    main { columns: 4; font-size: 8px; }
  </style>
</head>
<body><main><h1>Dense Review</h1><p>Key definitions, formulas, and proof templates.</p></main></body>
</html>
`:`<!doctype html>
<html lang="${t.locale}">
<head>
  <meta charset="utf-8">
  <style>@page { size: A4; margin: 20mm; } body { font-family: serif; }</style>
</head>
<body>
  <article>
    <h1>${J(D(n("preview.generatedEssay")))}</h1>
    <h2>${J(n("preview.introduction"))}</h2>
    <p>The generated HTML source is preserved even if PDF conversion fails.</p>
    <h2>${J(n("preview.argument"))}</h2>
    <p>Evidence and citations are recorded in the run manifest.</p>
  </article>
</body>
</html>
`}function J(e){return String(e||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}function ye(){const e=[`${er()} ${A(t.run.stage)}: ${t.run.message}`,`run ${t.run.id||n("source.notStarted")}`,`${n("source.status")} ${xt(t.run.status)}`];return t.run.error&&e.push(`${n("source.error")} ${t.run.error}`),e.join(`
`)}function Sn(e){return String(e||"").split(`
`).filter(Boolean).map(a=>{const r=a.indexOf(" "),s=r>0?a.slice(0,r):"log",l=r>0?a.slice(r+1):a;return`<p${/error|failed|traceback|exception|compile_failed/iu.test(a)?' class="is-error"':""}><span>${i(s)}</span> ${i(l)}</p>`}).join("")||`<p><span>${i(n("source.status"))}</span> ${i(n("source.noArtifactText"))}</p>`}function M(e){return t.artifacts.textByPath[e]||""}function N(e){return t.artifacts.pdfByPath[e]||{loading:!1,error:"",pageCount:0,currentPage:1,pages:{}}}function I(e){return!!t.artifacts.errorsByPath[e]}function B(e){const a=t.artifacts.errorsByPath[e.path]||n("source.artifactReadFailed");return`${n("source.artifactReadFailed")}
${e.path}
${a}`}function _(e,a){return(e?.path||"").split("/").filter(Boolean).pop()||a}function Rn(e){return e.endsWith(".json")||e.endsWith(".ipynb")?"json":e.endsWith(".html")||e.endsWith(".htm")?"html":"python"}function An(e){try{const a=JSON.parse(e),s=(Array.isArray(a.cells)?a.cells:[]).find(o=>o.cell_type==="markdown");return(Array.isArray(s?.source)?s.source.join(""):String(s?.source||"")).trim().replace(/\s+/gu," ").slice(0,220)||n("preview.notebookApproachBody")}catch{return n("preview.notebookApproachBody")}}function wt(e){try{const a=JSON.parse(e),s=(Array.isArray(a.cells)?a.cells:[]).find(o=>o.cell_type==="code");return(Array.isArray(s?.source)?s.source.join(""):String(s?.source||"")).trim()||e}catch{return e}}function pe(e,a="python"){return`
        <ol class="code-lines">
            ${String(e).replace(/\s+$/u,"").split(`
`).map((s,l)=>`
                <li>
                    <span class="line-no">${l+1}</span>
                    <code>${Mn(s,a)}</code>
                </li>
            `).join("")}
        </ol>
    `}function Mn(e,a){return a==="json"?En(e):a==="html"?Cn(e):Fn(e)}function Fn(e){const a=e.match(/#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+\b|\b[A-Za-z_][A-Za-z0-9_]*\b|\s+|./g)||[],r=new Set(["def","class","from","import","for","if","else","elif","return","continue","in","as","print","with","try","except","raise","while","True","False","None"]);return a.map((s,l)=>s.startsWith("#")?`<span class="syntax-comment">${i(s)}</span>`:s.startsWith('"')||s.startsWith("'")?`<span class="syntax-string">${i(s)}</span>`:/^\d+$/u.test(s)?`<span class="syntax-number">${i(s)}</span>`:r.has(s)?`<span class="syntax-keyword">${i(s)}</span>`:/^[A-Za-z_][A-Za-z0-9_]*$/u.test(s)&&$t(a,l)==="("?`<span class="syntax-function">${i(s)}</span>`:i(s)).join("")||" "}function En(e){const a=e.match(/"(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?|\s+|./g)||[];return a.map((r,s)=>r.startsWith('"')?`<span class="${$t(a,s)===":"?"syntax-keyword":"syntax-string"}">${i(r)}</span>`:/^(true|false|null)$/u.test(r)?`<span class="syntax-keyword">${i(r)}</span>`:/^-?\d+(?:\.\d+)?$/u.test(r)?`<span class="syntax-number">${i(r)}</span>`:i(r)).join("")||" "}function Cn(e){return(e.match(/<!--.*?-->|<\/?[A-Za-z][^>]*>|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|&[A-Za-z0-9#]+;|\s+|./g)||[]).map(r=>r.startsWith("<!--")?`<span class="syntax-comment">${i(r)}</span>`:/^<\/?[A-Za-z]/u.test(r)?`<span class="syntax-keyword">${i(r)}</span>`:r.startsWith('"')||r.startsWith("'")?`<span class="syntax-string">${i(r)}</span>`:/^&[A-Za-z0-9#]+;$/u.test(r)?`<span class="syntax-number">${i(r)}</span>`:i(r)).join("")||" "}function $t(e,a){for(let r=a+1;r<e.length;r+=1)if(!/^\s+$/u.test(e[r]))return e[r];return""}async function Nn(){const e=t.previewTab==="logs"?yt().text:t.previewTab==="manifest"?bt().text||JSON.stringify(Ze(),null,2):t.previewTab==="source"?xn():t.intent==="code_homework"?t.outputPreference==="ipynb"?ht():Ne(t.activeFile):Dn()||t.run.outputRoot||fe();await De(e,n("run.previewCopied"))}function Dn(){const e=x(t.artifacts.items,"primaryHtml",{intent:t.intent});return e?M(e.path):""}async function De(e,a){if(e){try{await navigator.clipboard.writeText(e),t.notice={message:a,tone:"success"}}catch{t.notice={message:n("run.clipboardUnavailable"),tone:"error"}}u()}}function In(){t.run.outputRoot&&De(t.run.outputRoot,n("run.pathRevealCopied"))}function Bn(e){if(!e)return;const a=e.startsWith("file://")?e:`file://${e}`;window.open(a,"_blank","noopener,noreferrer")}function On(e){return t.run.outputRoot?`${t.run.outputRoot.replace(/\/$/u,"")}/${e}`:""}function fe(){return t.artifacts.error?t.artifacts.error:t.artifacts.loading?n("source.artifactLoading"):t.artifacts.loaded?n("source.artifactLoaded"):t.run.outputRoot?n("source.artifactNoteReady"):n("source.artifactNotePending")}function Pt(){return w(t.run.status)?n("actions.running"):t.run.status==="failed"?n("actions.runAgain"):n("actions.runArtifact")}function kt(e){return w(t.run.status)?`
        <div class="comfort-progress" data-run-note-shell role="status" aria-live="polite" aria-label="${i(n("composer.progressAria"))}">
            <div class="comfort-progress-head">
                <strong>${i(n("composer.progressLabel"))}</strong>
                <span>${i(A(t.run.stage))}</span>
            </div>
            <div class="comfort-progress-track" aria-hidden="true">
                <span class="comfort-progress-fill"></span>
            </div>
            <p>${i(n("composer.progressNote"))}</p>
        </div>
    `:`<span class="run-note" data-run-note-shell>${i(Hn(e))}</span>`}function Hn(e){return e?t.taskText.trim()?t.files.some(a=>!a.uploadId)?n("composer.runNoteUploads"):w(t.run.status)?n("composer.runNoteRunning"):n("composer.runNoteReady"):n("composer.runNoteBrief"):n("composer.runNoteLogin")}function qn(){return t.run.status==="failed"?n("run.validationIssue"):t.run.status==="succeeded"?n("run.artifactReady"):w(t.run.status)?n("run.generating"):n("run.rendererArmed")}function Un(){return t.run.status==="failed"?t.run.errorCode||n("run.sourcePreserved"):t.run.status==="succeeded"?t.run.outputRoot?n("run.downloadOpenAvailable"):n("run.completed"):w(t.run.status)?A(t.run.stage):n("run.syntaxPreview")}function zn(e,a){return a==="queued"?"route":a==="succeeded"?t.intent==="code_homework"?"validate":"compile":e?.includes("context")||e?.includes("upload")?t.intent==="cheat_sheet"?"ingest":"context":e?.includes("search")||e?.includes("route")?"route":e?.includes("compile")?"compile":e?.includes("validate")?"validate":e?.includes("outline")?"outline":e?.includes("layout")?"layout":e?.includes("compress")?"compress":e?.includes("generate")||e?.includes("source")?t.intent==="beamer_slides"?"write":"generate":j().stages[0]}function A(e){const a=String(e||"compose"),r=n(`stages.${a}`);return r===`stages.${a}`?a.replaceAll("_"," "):r}function jn(e){return e.status==="uploaded"?n("uploads.uploaded"):e.status==="uploading"?n("uploads.uploading"):e.status==="failed"?n("uploads.failed"):Yn(e.size)}function Kn(e){return String(e).split(".").pop()?.slice(0,3).toUpperCase()||"FILE"}function Wn(){const e=localStorage.getItem(Je);if(_t(e))return e;const a=navigator.language||"";return a.toLowerCase().startsWith("zh")?a.toLowerCase().includes("tw")||a.toLowerCase().includes("hk")?"zh-Hant":"zh-Hans":Te}function Gn(e){const a=_t(e)?e:Te;t.locale!==a&&(t.locale=a,localStorage.setItem(Je,a),t.course.message="",t.course.tone="neutral",Jn(),t.run.status==="idle"&&t.run.stage==="compose"&&(t.run.message=n("run.ready")),u())}function _t(e){return je.some(a=>a.id===e)}function Tt(){document.documentElement.lang=t.locale,document.title=n("app.title")}function Vn(e){return{id:"session-ready",kind:"system",status:"idle",title:oe(e,"history.readyTitle"),message:oe(e,"history.readyMessage"),timestamp:new Date().toISOString()}}function Jn(){const e=t.history.find(a=>a.id==="session-ready");e&&(e.title=n("history.readyTitle"),e.message=n("history.readyMessage"))}function k(e,a){return n(`intents.${e}.${a}`)}function xt(e){const a=String(e||"idle"),r=n(`status.${a}`);return r===`status.${a}`?a:r}function n(e,a={}){return oe(t.locale,e,a)}function oe(e,a,r={}){const s=Be[Te]||{},l=Be[e]||s,o=ze(s,a),d=ze(l,a)??o??a;return typeof d!="string"?a:d.replace(/\{([A-Za-z0-9_]+)\}/g,(c,p)=>String(r[p]??""))}function ze(e,a){return String(a).split(".").reduce((r,s)=>{if(r&&Object.prototype.hasOwnProperty.call(r,s))return r[s]},e)}function Qn(){try{return JSON.parse(localStorage.getItem(_e)||"null")}catch{return null}}function L(e,a){const r=e?.error?.message||(typeof e?.detail=="string"?e.detail:"")||(typeof e?.message=="string"?e.message:"")||a,s=e?.error?.code?`${e.error.code}: `:"";return f(`${s}${r}`)}function f(e){return String(e||"").replace(/sk-[A-Za-z0-9_-]+/g,"[redacted-key]").replace(/Bearer\s+[A-Za-z0-9._-]+/gi,"Bearer [redacted-token]").replace(/api[_-]?key["'\s:=]+[A-Za-z0-9._-]+/gi,"api_key [redacted]").split(`
`).filter(a=>!/\s+at\s+/.test(a)&&!/Traceback/.test(a)).slice(0,3).join(" ").trim()}function Zn(e){return String(e||"").replace(/sk-[A-Za-z0-9_-]+/g,"[redacted-key]").replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi,"Bearer [redacted-token]").replace(/(api[_-]?key["'\s:=]+)[A-Za-z0-9._~+/=-]+/gi,"$1[redacted]").replace(/(authorization["'\s:=]+)[A-Za-z0-9._~+/=-]+/gi,"$1[redacted]")}function T(e){return Number(e||0).toLocaleString()}function me(e){return`${Math.round(Number(e||0)*100)}%`}function Yn(e){const a=Number(e||0);return a>=1024*1024?`${(a/(1024*1024)).toFixed(1)} MB`:a>=1024?`${Math.round(a/1024)} KB`:`${a} B`}function U(e){return n(e==="critical"?"context.critical":e==="warning"?"context.warning":"context.ok")}function z(e){const a=String(e||"local").toLowerCase();return a==="local"?n("context.local"):a==="heuristic"?n("context.heuristic"):a==="provider"?n("context.provider"):e}function Lt(e){return e.warning_level==="critical"?n("context.criticalSummary"):e.warning_level==="warning"?n("context.warningSummary"):n("context.ratioSummary",{percent:me(e.utilization_ratio)})}function St(e){return n("context.aria",{state:U(e.warning_level),percent:me(e.utilization_ratio),source:z(e.source)})}function D(e){const r=(t.taskText.trim().split(`
`).find(Boolean)||"").replace(/[^\w\s:,-]/g,"").trim();return r?r.length>52?`${r.slice(0,49)}...`:r:e}function Rt(e){return String(e||"").slice(0,8)||"pending"}function Xn(e){try{return new Intl.DateTimeFormat(void 0,{hour:"2-digit",minute:"2-digit"}).format(new Date(e))}catch{return""}}function er(){return new Intl.DateTimeFormat(void 0,{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date)}function At(e){const a=String(e||"");return a.length<=46?a:`...${a.slice(-43)}`}function i(e){return String(e??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}

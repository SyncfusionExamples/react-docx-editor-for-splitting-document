import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import { DocumentEditorContainerComponent, Ribbon } from '@syncfusion/ej2-react-documenteditor';
import { DialogComponent } from '@syncfusion/ej2-react-popups';
import { ListViewComponent } from '@syncfusion/ej2-react-lists';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';
import { TitleBar } from './title-bar';
import { splitByBookmark } from './file-data';
import './index.css';

DocumentEditorContainerComponent.Inject(Ribbon);

type HeadingListItem = {
    name: string;
    category: string;
    content: string;
};

const SplitDocument = () => {
    useEffect(() => {
        // Initialize after first render to wire up title bar and editor defaults
        setTimeout(() => initContainer(), 0);
    }, []);
    const dialogRef = useRef<DialogComponent>(null);
    const viewContainerRef = useRef<DocumentEditorContainerComponent>(null);
    const [isDialogOpen, setDialogOpen] = useState(false);
    let hostUrl = "https://document.syncfusion.com/web-services/docx-editor/api/documenteditor/";
    let titleBar: TitleBar | null = null;
    const containerRef = useRef<DocumentEditorContainerComponent>(null);    
    const [listData, setListData] = useState<Record<string, any>[]>([]);

    const onCreated = () => {
        const mainEditor = containerRef.current?.documentEditor;
        if (!mainEditor) return;
        
        mainEditor.open(JSON.stringify(splitByBookmark));
    }

    function initContainer() {
        if (!viewContainerRef.current)
            return;
        const editor = viewContainerRef.current.documentEditor;
        // Title bar hookup
        titleBar = new TitleBar(document.getElementById("documenteditor_titlebar"), editor, true, false, dialogRef.current);
        // Basic defaults
        editor.pageOutline = '#E0E0E0';
        editor.acceptTab = true;
        // Keep title updated
        viewContainerRef.current.documentChange = () => {
            titleBar?.updateDocumentTitle();
            editor.focusIn();
        };
        viewContainerRef.current.resize();
    }
    
    function dialogOpen() {
        setDialogOpen(true);
        // Ensure sizing is correct when dialog is visible
        setTimeout(() => {
            if(viewContainerRef.current)
                viewContainerRef.current.documentEditor?.resize();
        }, 0);
    }

    function dialogClose() {
        setDialogOpen(false);
    }    

    function openDoc(name: string) {
        if (!viewContainerRef.current)
            return;
        dialogOpen();
        const editor = viewContainerRef.current.documentEditor;
        const item = listData.find((entry) => entry.name === name);
        if(item){
            editor.open(item.content);
            editor.isReadOnly = true;
            editor.enableContextMenu = false;
            const downloadButton = document.getElementById('documenteditor-share');
            if (downloadButton)
                downloadButton.style.display = 'block';
            const closeButton = document.getElementById('de-close');
            if (closeButton)
                closeButton.style.display = 'block';
            editor.documentName = name;
            const titleEl = document.getElementById('documenteditor_title_name');
            if (titleEl)
                titleEl.textContent = editor.documentName;            
        }
        viewContainerRef.current.resize();
    }
    
    const splitBoomarksClick = async () => {
        
        showHideWaitingIndicator(true);

        // Give React/browser one frame to render
        await new Promise(resolve => setTimeout(resolve, 0));

        const mainEditor = containerRef.current?.documentEditor;
        if (!mainEditor) {
            showHideWaitingIndicator(false);
            return;
        }
        
        mainEditor.selection.moveToDocumentStart();
        const bookMarkItems = mainEditor.getBookmarks();

        const bookmarkList = bookMarkItems.map((bmName) => {

            mainEditor.selection.selectBookmark(bmName);

            return {
                name: bmName,
                category: "Bookmarks",
                content: mainEditor.selection.sfdt
            };

        });

        setListData(bookmarkList);

        mainEditor.selection.moveToDocumentStart();

        showHideWaitingIndicator(false);
    };

    const splitHeadingsClick = async () => {

        showHideWaitingIndicator(true);

        // Give React/browser one frame to render
        await new Promise(resolve => setTimeout(resolve, 0));

        const documentEditor = containerRef.current?.documentEditor;

        if (!documentEditor) {
            showHideWaitingIndicator(false);
            return;
        }

        const selection = documentEditor.selection;
        const headingList: HeadingListItem[] = [];

        // Move to the start of the document
        selection.moveToDocumentStart();

        //const documentStart = selection.startOffset;

        let foundHeading = false;

        let currentHeadingText = "";
        let currentHeadingStart = "";

        while (true) {
            const style = selection.paragraphFormat.styleName;

            if (style.startsWith("Heading")) {
                // Read the heading text from the current paragraph
                selection.selectParagraph();

                const headingText = selection.getText(false).trim();
                const headingStart = selection.startOffset;
                const headingEnd = selection.endOffset;

                // Keep caret collapsed so next traversal continues normally
                selection.select(headingEnd, headingEnd);

                if (!foundHeading) {
                    foundHeading = true;
                } else {
                    // Export previous heading section:
                    // from previous heading start to current heading start
                    selection.select(currentHeadingStart, headingStart);

                    headingList.push({
                        name: currentHeadingText,
                        category: "Headings",
                        content: selection.sfdt
                    });

                    // Collapse again after export
                    selection.select(headingEnd, headingEnd);
                }

                // Remember current heading
                currentHeadingText = headingText;
                currentHeadingStart = headingStart;
            }

            const beforeMove = selection.startOffset;
            selection.moveToNextParagraph();
            const afterMove = selection.startOffset;

            // If caret did not move, we reached the last paragraph
            if (beforeMove === afterMove) {
                break;
            }
        }

        // No headings in the whole document
        if (!foundHeading) {
            // selection.selectParagraph();

            // headingList.push({
            //     name: "No headings ",
            //     category: "Headings",
            //     content: selection.sfdt
            // });
            setListData(headingList);
            selection.moveToDocumentStart();
            showHideWaitingIndicator(false);
            return;
        }

        // Export the last heading section up to the end of the document
        selection.selectParagraph();
        const documentEnd = selection.endOffset;

        selection.select(currentHeadingStart, documentEnd);

        headingList.push({
            name: currentHeadingText,
            category: "Headings",
            content: selection.sfdt
        });

        setListData(headingList);

        selection.moveToDocumentStart();

        showHideWaitingIndicator(false);
        
    };

    const handleViewClick = (name: string) => {
        openDoc(name);
    };

    const showHideWaitingIndicator = (show: boolean) => {
        let waitingPopUp: HTMLElement | null = document.getElementById("waiting-popup");
        let inActiveDiv: HTMLElement | null = document.getElementById("popup-overlay");
        if(waitingPopUp && inActiveDiv){
            inActiveDiv.style.display = show ? "block" : "none";
            waitingPopUp.style.display = show ? "block" : "none";
        }
    };

    return (
        <div style={{ height: "80px" }}>
            <h1>Split Word Document by Bookmarks and Headings - DOCX Editor</h1>
        <div className="control-pane">
            <div className="control-section" style={{  display: "flex" }}>
                <div className="control-section" style={{  width: "80%", position: "relative", paddingRight: "15px", paddingLeft: "15px" }}>
                    <DocumentEditorContainerComponent id="container" ref={containerRef} style={{ display: "block" }} height='880px'
                        serviceUrl={hostUrl} enableToolbar={true} toolbarMode='Ribbon' created={onCreated}>
                    </DocumentEditorContainerComponent>
                </div>
                <div
                    className="list-section"
                    style={{
                        width: "20%",
                        position: "relative",
                        height: "590px"
                    }}>
                    <div style={{display: 'flex', gap: 10}}>
                        <ButtonComponent
                            id="splitBookmarkButton"
                            cssClass="e-primary"
                            onClick={splitBoomarksClick}>
                            Split Bookmarks
                        </ButtonComponent>
                        <ButtonComponent
                            id="splitHeadingButton"
                            cssClass="e-primary"
                            onClick={splitHeadingsClick}>
                            Split Headings
                        </ButtonComponent>
                    </div>

                    {listData.length === 0 ? (
                        <div
                            style={{
                                marginTop: "30px",
                                padding: "16px",
                                textAlign: "center",
                                lineHeight: "1.6"
                            }}>
                            <div
                                style={{
                                    fontWeight: 600,
                                    marginBottom: "8px"
                                }}>
                                No bookmark or headings generated.
                            </div>

                            <div
                                style={{
                                    fontSize: "13px"
                                }}>
                                Click <strong>Split Bookmarks</strong> or <strong>Split Headings</strong>  to extract them.
                            </div>
                        </div>
                    ) : (
                        <ListViewComponent
                            id="listView"
                            height='880px'
                            dataSource={listData}
                            fields={{ text: "text", groupBy: "category" }}
                            template={(item: Record<string, any>) => (
                                <div className="doc-row">
                                    <span
                                        className="doc-title"
                                        title={item.name}>
                                        {item.name}
                                    </span>

                                    <ButtonComponent
                                        type="button"
                                        className="e-de-view-btn"
                                        title="View Content"
                                        onClick={() => handleViewClick(item.name)}>
                                        <span className="e-icons e-eye"></span>
                                    </ButtonComponent>
                                </div>
                            )}
                        />
                    )}
                </div>                
            </div>
            {/* Loading Progress */}
            <div className="overlay" id="popup-overlay"></div>
            <div id="waiting-popup">
                <svg className="circular" height="40" width="40">
                    <circle
                    className="circle-path"
                    cx="25"
                    cy="25"
                    r="20"
                    fill="none"
                    strokeWidth="6"
                    strokeMiterlimit="10" 
                    />
                </svg>
            </div>  
            <DialogComponent id="defaultDialog" visible={isDialogOpen} minHeight={'90%'} width={'90%'} height={'90%'} 
                isModal={true} ref={dialogRef} open={dialogOpen} close={dialogClose}>
                <div id="documenteditor_titlebar" className="e-de-ctn-title" style={{ display: "flow-root" }}></div>
                <div id="documenteditor_container_body">
                    <DocumentEditorContainerComponent showPropertiesPane={false} id="viewContainer" height='780px' 
                        ref={viewContainerRef} style={{ display: "block" }} serviceUrl={hostUrl} zIndex={3000} enableToolbar={false}>
                    </DocumentEditorContainerComponent>        
                </div>
            </DialogComponent>

        </div>
        </div>
    );
};
export default SplitDocument;
const rootElement: HTMLElement | null = document.getElementById('sample');
if(rootElement)
    createRoot(rootElement).render(<SplitDocument />);

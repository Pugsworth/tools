import React from 'react';
import LivePreview from './LivePreview';
import ExtractedList from './ExtractedList';

export default function Sidebar({
    isVertical,
    sidebarWidth,
    bottomPanelHeight,
    verticalPreviewWidth,
    previewPanelHeight,
    selectedRegion,
    selectedRegionId,
    setRegions,
    previewContainerRef,
    handlePreviewWheel,
    handlePreviewMouseDown,
    handlePreviewMouseMove,
    handlePreviewMouseUp,
    livePreview,
    previewTransform,
    isPreviewPanning,
    setPreviewTransform,
    snapshotCurrent,
    setResizingState,
    extractedImages,
    setExtractedImages,
    copyCoords
}) {
    return (
        <div
            id="sidebar-panel"
            className={`bg-gray-850 border-gray-700 flex flex-col shadow-xl z-10 ${isVertical ? 'w-full flex-row border-t' : 'h-full flex-col border-l'}`}
            style={isVertical ? { height: bottomPanelHeight } : { width: sidebarWidth }}
        >
            <LivePreview
                isVertical={isVertical}
                verticalPreviewWidth={verticalPreviewWidth}
                previewPanelHeight={previewPanelHeight}
                selectedRegion={selectedRegion}
                selectedRegionId={selectedRegionId}
                setRegions={setRegions}
                previewContainerRef={previewContainerRef}
                handlePreviewWheel={handlePreviewWheel}
                handlePreviewMouseDown={handlePreviewMouseDown}
                handlePreviewMouseMove={handlePreviewMouseMove}
                handlePreviewMouseUp={handlePreviewMouseUp}
                livePreview={livePreview}
                previewTransform={previewTransform}
                isPreviewPanning={isPreviewPanning}
                setPreviewTransform={setPreviewTransform}
                snapshotCurrent={snapshotCurrent}
                setResizingState={setResizingState}
            />

            {/* Resizer (Preview Panel - only horizontal mode) */}
            {!isVertical && (
                <div
                    className="h-1 bg-black hover:bg-blue-500 cursor-row-resize z-50 transition-colors"
                    onMouseDown={() => setResizingState('preview')}
                />
            )}

            <ExtractedList
                isVertical={isVertical}
                extractedImages={extractedImages}
                setExtractedImages={setExtractedImages}
                copyCoords={copyCoords}
            />
        </div>
    );
}

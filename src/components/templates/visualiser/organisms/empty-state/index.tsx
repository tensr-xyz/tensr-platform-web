'use client';

import React, { useRef } from 'react';
import { Upload, Search, FileText } from 'lucide-react';
import { Button } from '@/components/templates/visualiser/atoms/button';

interface EmptyStateProps {
  onFileSelect: (file: File) => void;
}

export function EmptyState({ onFileSelect }: EmptyStateProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const publicDatasets = [
    { name: 'NYT Covid' },
    { name: 'Global Startup Unicorns' },
    { name: "NBA Per-Game Stats ('23-24)" },
  ];

  return (
    <div
      className="relative h-full w-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Spreadsheet Grid Background */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="h-full w-full relative">
          {/* Column headers row */}
          <div className="absolute top-0 left-0 right-0 h-8 border-b border-[#171717]">
            <div className="flex h-full">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="h-full border-r border-[#171717]"
                  style={{ width: '120px' }}
                />
              ))}
            </div>
          </div>
          {/* Grid cells */}
          <div
            className="h-full w-full pt-8"
            style={{
              backgroundImage: `
                linear-gradient(to right, #171717 1px, transparent 1px),
                linear-gradient(to bottom, #171717 1px, transparent 1px)
              `,
              backgroundSize: '120px 28px',
            }}
          />
          {/* Row numbers column */}
          <div className="absolute top-8 left-0 bottom-0 w-12 border-r border-[#171717]">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="h-7 border-b border-[#171717]" />
            ))}
          </div>
        </div>
      </div>

      {/* Children Container */}
      <div className="relative z-[2] h-full w-full">
        {/* Paste Tooltip - Top Left */}
        <div className="absolute left-[38px] top-[38px] shadow-[0px_4px_8px_rgba(0,0,0,0.12)] transition-all duration-200 ease-in-out">
          {/* Caret */}
          <div className="absolute -top-2 left-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="9"
              viewBox="0 0 18 9"
              fill="none"
            >
              <path
                d="M-0.000385802 8.52148L8.5208 0.00029538L17.042 8.52148H-0.000385802Z"
                fill="#171717"
              />
            </svg>
          </div>
          {/* Callout */}
          <div className="flex w-auto max-w-[320px] items-center gap-6 bg-[#171717] p-4 pr-6 pl-4 transition-all duration-200 ease-in-out">
            {/* Icons Container - Outer (56x56px) */}
            <div
              className="flex shrink-0 items-center justify-center self-center"
              style={{
                width: '56px',
                height: '56px',
              }}
            >
              {/* Icons Container - Inner (56x47px) */}
              <div
                className="relative shrink-0"
                style={{
                  width: '56px',
                  height: '47px',
                }}
              >
                {/* Excel Icon - bottom layer */}
                <div
                  className="absolute shrink-0"
                  style={{
                    top: '-2px',
                    left: '12px',
                    width: '26px',
                    height: '26px',
                    backgroundImage: 'url(/excel-large.png)',
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    zIndex: 1,
                  }}
                />
                {/* Sheets Icon - middle layer, overlapping Excel */}
                <div
                  className="absolute shrink-0"
                  style={{
                    top: '8px',
                    left: '30px',
                    width: '20px',
                    height: '26px',
                    backgroundImage: 'url(/sheets-large.png)',
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    zIndex: 2,
                  }}
                />
                {/* Paste Badge - bottom layer */}
                <div
                  className="absolute inline-flex items-center justify-center rounded text-white"
                  style={{
                    top: '36px',
                    left: '12px',
                    padding: '2px 4px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(2px)',
                    fontSize: '12px',
                    fontWeight: 600,
                    lineHeight: '16px',
                    zIndex: 3,
                  }}
                >
                  ⌘+V
                </div>
              </div>
            </div>
            {/* Text */}
            <div className="flex-1">
              <div className="mb-1 text-sm font-medium text-white">Paste directly from sheets</div>
              <div className="text-xs text-gray-300">
                Copy the whole sheet from Excel or Google Sheets and paste it here
              </div>
            </div>
          </div>
        </div>

        {/* Centered Content Container */}
        <div className="absolute left-[500px] top-[76px] inline-flex flex-col items-center justify-start gap-6 overflow-hidden bg-white p-[42px] shadow-[0px_28px_108px_0px_rgba(0,0,0,0.09)]">
          <div className="flex flex-col items-center gap-6">
            {/* Main Content Box */}
            <div className="h-[280px] w-[420px] bg-gray-100 pt-6 px-8">
              <div className="flex flex-col items-center gap-6">
                {/* Spreadsheet Icon */}
                <div className="flex justify-center">
                  <svg
                    width="64"
                    height="64"
                    viewBox="0 0 64 64"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M36.2666 28.7988H27.7333V33.0655H36.2666V28.7988Z" fill="#DBDBDB" />
                    <path d="M46.9334 35.1992H38.4V39.4659H46.9334V35.1992Z" fill="#DBDBDB" />
                    <path d="M36.2666 41.5996H27.7333V45.8663H36.2666V41.5996Z" fill="#DBDBDB" />
                    <path d="M25.6 35.1992H17.0667V39.4659H25.6V35.1992Z" fill="#DBDBDB" />
                    <path d="M36.2666 48H27.7333V52.2667H36.2666V48Z" fill="#DBDBDB" />
                    <path d="M36.2666 35.1992H27.7333V39.4659H36.2666V35.1992Z" fill="#DBDBDB" />
                    <path d="M46.9334 41.5996H38.4V45.8663H46.9334V41.5996Z" fill="#DBDBDB" />
                    <path d="M46.9334 48H38.4V52.2667H46.9334V48Z" fill="#DBDBDB" />
                    <path d="M25.6 48H17.0667V52.2667H25.6V48Z" fill="#DBDBDB" />
                    <path d="M25.6 41.5996H17.0667V45.8663H25.6V41.5996Z" fill="#DBDBDB" />
                    <path
                      d="M54.4 1.06641H26.6667C26.4533 1.06641 26.4533 1.06641 26.24 1.06641C26.0267 1.06641 26.0267 1.27974 25.8133 1.27974L8.74666 18.3464C8.74666 18.3464 8.53333 18.5597 8.53333 18.7731C8.53333 18.9864 8.53333 18.9864 8.53333 19.1997V61.8664C8.53333 62.5064 8.95999 62.9331 9.59999 62.9331H54.4C55.04 62.9331 55.4667 62.5064 55.4667 61.8664V2.13307C55.4667 1.49307 55.04 1.06641 54.4 1.06641ZM25.6 4.69307V18.1331H12.16L25.6 4.69307ZM49.0667 53.3331C49.0667 53.9731 48.64 54.3997 48 54.3997H16C15.36 54.3997 14.9333 53.9731 14.9333 53.3331V27.7331C14.9333 27.0931 15.36 26.6664 16 26.6664H48C48.64 26.6664 49.0667 27.0931 49.0667 27.7331V53.3331Z"
                      fill="#DBDBDB"
                    />
                    <path d="M46.9334 28.7988H38.4V33.0655H46.9334V28.7988Z" fill="#DBDBDB" />
                    <path d="M25.6 28.7988H17.0667V33.0655H25.6V28.7988Z" fill="#DBDBDB" />
                  </svg>
                </div>

                {/* Title and Subtitle */}
                <div className="text-center">
                  <div className="mb-1 text-lg font-semibold">Analyze your data</div>
                  <div className="text-sm text-muted-foreground">
                    Drag and drop a CSV file or hit the button below
                  </div>
                </div>

                {/* Upload Button */}
                <div className="flex justify-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="text/csv,.csv,.xlsx,.xls"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <Button onClick={handleUploadClick} className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload a dataset
                  </Button>
                </div>

                {/* CSV formats supported */}
                <div className="text-xs text-muted-foreground">CSV formats supported</div>
              </div>
            </div>

            {/* Search Input */}
            <div className="box-border flex w-full shrink-0 items-center gap-2 bg-gray-200 p-2 px-1">
              <div className="flex items-center">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <input
                type="text"
                placeholder="Search datasets..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Public Datasets */}
            <div className="flex w-full flex-1 flex-col items-start justify-center gap-2 self-stretch pb-0">
              <div className="text-sm font-medium text-muted-foreground">
                Explore public datasets
              </div>
              <div className="flex w-full flex-col gap-1">
                {publicDatasets.map((dataset, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-muted/50"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{dataset.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

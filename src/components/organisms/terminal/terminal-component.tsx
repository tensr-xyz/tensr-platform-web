'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

// Add custom CSS to constrain terminal width and fix theming
const terminalStyles = `
  .terminal-container .xterm-screen {
    max-width: 100% !important;
    width: 100% !important;
    background-color: transparent !important;
    color: #1f2937 !important;
  }
  .terminal-container .xterm-viewport {
    max-width: 100% !important;
    width: 100% !important;
    background-color: transparent !important;
  }
  .terminal-container .xterm-rows {
    max-width: 100% !important;
    width: 100% !important;
    color: #1f2937 !important;
  }
  .terminal-container .xterm-rows > div {
    max-width: 100% !important;
    width: 100% !important;
    color: #1f2937 !important;
  }
  .terminal-container .xterm {
    background-color: transparent !important;
    color: #1f2937 !important;
  }
  .terminal-container .xterm-rows span {
    color: #1f2937 !important;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = terminalStyles;
  document.head.appendChild(styleSheet);
}

export interface TerminalComponentProps {
  onCommand?: (command: string) => void;
}

const TerminalComponent: React.FC<TerminalComponentProps> = ({ onCommand }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const currentLineRef = useRef<string>('');
  const [isReady, setIsReady] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) {
      console.log('Terminal ref not available');
      return;
    }

    console.log('Initializing terminal...');
    const terminal = new XTerm({
      theme: {
        background: 'transparent',
        foreground: '#1f2937', // Dark gray for light theme
        cursor: '#1f2937', // Dark gray cursor
        black: '#000000',
        red: '#dc2626',
        green: '#16a34a',
        yellow: '#ca8a04',
        blue: '#2563eb',
        magenta: '#9333ea',
        cyan: '#0891b2',
        white: '#1f2937', // Dark gray for light theme
        brightBlack: '#6b7280', // Muted gray
        brightRed: '#dc2626',
        brightGreen: '#16a34a',
        brightYellow: '#ca8a04',
        brightBlue: '#2563eb',
        brightMagenta: '#9333ea',
        brightCyan: '#0891b2',
        brightWhite: '#1f2937', // Dark gray for light theme
      },
      fontSize: 13,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      tabStopWidth: 4,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    console.log('Terminal opened successfully');

    // Initial welcome message
    terminal.writeln('Welcome to Tensr Terminal');
    terminal.writeln('Type "help" for available commands');
    terminal.write('$ ');

    // Handle terminal input
    terminal.onData(data => {
      const code = data.charCodeAt(0);

      if (code === 13) {
        // Enter key
        terminal.writeln('');

        if (currentLineRef.current.trim()) {
          const command = currentLineRef.current.trim();
          setCommandHistory(prev => [...prev, command]);
          setHistoryIndex(-1);

          // Execute command
          executeCommand(command, terminal);

          if (onCommand) {
            onCommand(command);
          }
        }

        currentLineRef.current = '';
        terminal.write('$ ');
      } else if (code === 127) {
        // Backspace
        if (currentLineRef.current.length > 0) {
          terminal.write('\b \b');
          currentLineRef.current = currentLineRef.current.slice(0, -1);
        }
      } else if (code === 27) {
        // Escape sequence (arrow keys)
        // Handle arrow keys for command history
        if (data.length > 1) {
          const sequence = data.slice(1);
          if (sequence === '[A') {
            // Up arrow - previous command
            if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
              const newIndex = historyIndex + 1;
              const command = commandHistory[commandHistory.length - 1 - newIndex];

              // Clear current line
              terminal.write('\r$ ');
              for (let i = 0; i < currentLineRef.current.length; i++) {
                terminal.write(' ');
              }
              terminal.write('\r$ ');

              terminal.write(command);
              currentLineRef.current = command;
              setHistoryIndex(newIndex);
            }
          } else if (sequence === '[B') {
            // Down arrow - next command
            if (historyIndex > 0) {
              const newIndex = historyIndex - 1;
              const command = commandHistory[commandHistory.length - 1 - newIndex];

              // Clear current line
              terminal.write('\r$ ');
              for (let i = 0; i < currentLineRef.current.length; i++) {
                terminal.write(' ');
              }
              terminal.write('\r$ ');

              terminal.write(command);
              currentLineRef.current = command;
              setHistoryIndex(newIndex);
            } else if (historyIndex === 0) {
              // Clear current line
              terminal.write('\r$ ');
              for (let i = 0; i < currentLineRef.current.length; i++) {
                terminal.write(' ');
              }
              terminal.write('\r$ ');

              currentLineRef.current = '';
              setHistoryIndex(-1);
            }
          }
        }
      } else if (code >= 32 && code <= 126) {
        // Printable characters
        terminal.write(data);
        currentLineRef.current += data;
      }
    });

    setIsReady(true);

    // Auto-focus the terminal
    setTimeout(() => {
      terminal.focus();
    }, 100);

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (error) {
          console.warn('Terminal fit error:', error);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Add ResizeObserver to handle panel resizing
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(() => {
        if (fitAddonRef.current && xtermRef.current) {
          try {
            fitAddonRef.current.fit();
          } catch (error) {
            console.warn('Terminal fit error:', error);
          }
        }
      }, 10);
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, []);

  // Execute command
  const executeCommand = (command: string, terminal: XTerm) => {
    const cmd = command.toLowerCase().trim();

    switch (cmd) {
      case 'help':
        terminal.writeln('Available commands:');
        terminal.writeln('  help     - Show this help message');
        terminal.writeln('  clear    - Clear the terminal');
        terminal.writeln('  ls       - List files (simulated)');
        terminal.writeln('  pwd      - Print working directory');
        terminal.writeln('  whoami   - Show current user');
        terminal.writeln('  date     - Show current date and time');
        terminal.writeln('  echo     - Echo text');
        terminal.writeln('  status   - Show project status');
        terminal.writeln('  version  - Show Tensr version');
        terminal.writeln('  exit     - Close terminal');
        break;

      case 'clear':
        terminal.clear();
        break;

      case 'ls':
        terminal.writeln('data/');
        terminal.writeln('scripts/');
        terminal.writeln('config.json');
        terminal.writeln('README.md');
        terminal.writeln('notebook.ipynb');
        break;

      case 'pwd':
        terminal.writeln('/workspace/project');
        break;

      case 'whoami':
        terminal.writeln('tensr-user');
        break;

      case 'date':
        terminal.writeln(new Date().toString());
        break;

      case 'status':
        terminal.writeln('Project Status: Active');
        terminal.writeln('Last Modified: ' + new Date().toLocaleDateString());
        terminal.writeln('Files: 5');
        terminal.writeln('Collaborators: 1');
        break;

      case 'version':
        terminal.writeln('Tensr Platform v1.0.0');
        terminal.writeln('Terminal v1.0.0');
        break;

      case 'exit':
        terminal.writeln('Terminal closed');
        // You could emit an event here to close the terminal panel
        break;

      default:
        if (cmd.startsWith('echo ')) {
          const text = command.slice(5);
          terminal.writeln(text);
        } else if (cmd.startsWith('cat ')) {
          const filename = command.slice(4);
          terminal.writeln(`Contents of ${filename}:`);
          terminal.writeln('This is a simulated file content.');
          terminal.writeln('In a real implementation, this would show actual file contents.');
        } else {
          terminal.writeln(`Command not found: ${command}`);
          terminal.writeln('Type "help" for available commands');
        }
        break;
    }
  };

  return (
    <div
      ref={terminalRef}
      className="terminal-container h-full w-full font-mono text-sm cursor-text overflow-hidden p-4"
      style={{
        minWidth: 0,
        minHeight: 0,
        maxWidth: '100%',
        maxHeight: '100%',
      }}
      onClick={() => {
        // Focus the terminal when clicked
        if (xtermRef.current) {
          xtermRef.current.focus();
        }
      }}
    />
  );
};

export default TerminalComponent;

"use client"

import React, {useState} from 'react';
import {
    Search,
    Package,
    Tag,
    History,
    Users, Settings,
} from 'lucide-react';
import { cn } from "@/utils";
import Link from "next/link";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/molecules/dialog";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/organisms/command';
import {Button} from "@/components/atoms/button";
import {LuArrowRight} from "react-icons/lu";
import {EmailForm, OTPForm} from "@/components/organisms/forms/auth-form";
import useAuth from '@/hooks/api/use-auth';

export const CommandSearch = () => {
    const [open, setOpen] = React.useState(false)
    const commandRef = React.useRef<HTMLDivElement>(null)

    // Set up event listeners to handle clicking outside to close
    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (commandRef.current && !commandRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }

        // Handle Cmd+K shortcut
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen(true)
                // Focus the input when opened with keyboard shortcut
                const input = commandRef.current?.querySelector('input')
                if (input) input.focus()
            }

            // Close on escape
            if (e.key === "Escape") {
                setOpen(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        document.addEventListener("keydown", handleKeyDown)

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
            document.removeEventListener("keydown", handleKeyDown)
        }
    }, [])

    // Handle input focus
    const handleFocus = () => setOpen(true)
    const handleBlur = () => {
        // Don't close immediately on blur to allow for clicking on menu items
        // This will be handled by the click outside handler
    }

    return (
        <div className="relative w-full" ref={commandRef}>
            <div className="flex items-center border-0 px-3" cmdk-input-wrapper="">
                <Search className="mr-2 h-5 w-5 shrink-0 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search by name or cert #"
                    className="h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-gray-400"
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                />
                <span className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium opacity-50">
          <span className="text-xs">⌘</span>K
        </span>
            </div>

            {open && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1">
                    <Command className="rounded-md border shadow-md bg-white">
                        <CommandList className="max-h-[300px] overflow-y-auto">
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup heading="Suggestions">
                                <CommandItem>
                                    <span>Popular Cards</span>
                                </CommandItem>
                                <CommandItem>
                                    <History className="mr-2 h-4 w-4" />
                                    <span>Trending This Week</span>
                                </CommandItem>
                                <CommandItem>
                                    <span className="mr-2 h-2 w-2 rounded-full bg-red-500" />
                                    <span>Live Auctions</span>
                                </CommandItem>
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup heading="Categories">
                                <CommandItem>
                                    <Package className="mr-2 h-4 w-4" />
                                    <span>Sports Cards</span>
                                </CommandItem>
                                <CommandItem>
                                    <Package className="mr-2 h-4 w-4" />
                                    <span>TCG (Trading Card Games)</span>
                                </CommandItem>
                                <CommandItem>
                                    <Package className="mr-2 h-4 w-4" />
                                    <span>Memorabilia</span>
                                </CommandItem>
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup heading="Tools">
                                <CommandItem>
                                    <Tag className="mr-2 h-4 w-4" />
                                    <span>Price Guide</span>
                                </CommandItem>
                                <CommandItem>
                                    <Users className="mr-2 h-4 w-4" />
                                    <span>Grading Companies</span>
                                </CommandItem>
                                <CommandItem>
                                    <Search className="mr-2 h-4 w-4" />
                                    <span>Certificate Lookup</span>
                                </CommandItem>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </div>
            )}
        </div>
    )
}

const DefaultTrigger = () => (
    <Button
        variant='ghost'
        className='px-4 h-9 hover:rounded-full rounded-full group'
    >
        Log in
        <LuArrowRight className='h-4 w-4 transition-transform group-hover:translate-x-1' />
    </Button>
);

const LoginDialog = ({
                         trigger,
                         className
                     }: {
    trigger?: React.ReactNode;
    className?: string;
}) => {
    // State for the dialog
    const [isOpen, setIsOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [showOTP, setShowOTP] = useState(false);
    const [activeSession, setActiveSession] = useState<string | null>(null);

    // Handle email form success - Now gets the session directly
    const handleEmailSuccess = (emailAddress: string, session: string) => {
        console.log("Email auth success, received session");
        setEmail(emailAddress);
        setActiveSession(session);
        setShowOTP(true);
    };

    // Handle dialog close - reset state
    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            // Only reset form state when dialog closes
            setShowOTP(false);
            setEmail('');
            setActiveSession(null);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <div className="cursor-pointer">
                    {trigger || <DefaultTrigger />}
                </div>
            </DialogTrigger>
            <DialogContent className={`sm:max-w-[425px] ${className || ''}`}>
                {showOTP && email && activeSession ? (
                    <OTPForm email={email} session={activeSession} />
                ) : (
                    <EmailForm onSuccess={handleEmailSuccess} />
                )}
            </DialogContent>
        </Dialog>
    );
};

export default function Header() {
    const { user, isAuthenticated } = useAuth();

    return (
        <header>
            <div className="flex items-center justify-between px-6 py-3 bg-white border-b">
                <div className="flex items-center space-x-8">
                    <h1 className="text-xl font-bold text-gray-800">Projects</h1>
                    <div className="flex space-x-6">
                        <button className="text-gray-600 hover:text-gray-900 font-medium">Recent</button>
                        <button className="text-gray-600 hover:text-gray-900 font-medium">All Projects</button>
                        <button className="text-gray-600 hover:text-gray-900 font-medium">Shared</button>
                        <button className="text-gray-600 hover:text-gray-900 font-medium">Templates</button>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    {isAuthenticated && user ? (
                        <>
                            <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                                    {user.email.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-gray-700">{user.email}</span>
                            </div>
                            <button className="p-1 text-gray-500 hover:text-gray-700">
                                <Settings className="w-5 h-5" />
                            </button>
                        </>
                    ) : (
                        <LoginDialog />
                    )}
                </div>
            </div>
        </header>
    );
};

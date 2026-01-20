import Image from 'next/image';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
    className?: string;
    theme?: 'light' | 'dark';
}

export function Logo({ size = 'md', showText = true, className = '', theme = 'light' }: LogoProps) {
    const sizes = {
        sm: { icon: 24, text: 'text-lg' },
        md: { icon: 32, text: 'text-xl' },
        lg: { icon: 48, text: 'text-3xl' },
    };

    const currentSize = sizes[size];

    const textColors = theme === 'dark'
        ? { primary: 'text-white', accent: 'text-indigo-400' }
        : { primary: 'text-gray-900', accent: 'text-indigo-600' };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <Image
                src="/logo.svg"
                alt="PDFGenAI Logo"
                width={currentSize.icon}
                height={currentSize.icon}
                className="flex-shrink-0"
            />
            {showText && (
                <span className={`font-bold ${currentSize.text}`}>
                    <span className={textColors.primary}>PDFGen</span>
                    <span className={textColors.accent}>AI</span>
                </span>
            )}
        </div>
    );
}

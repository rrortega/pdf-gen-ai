"use client";

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
    chart: string;
    className?: string;
}

export default function MermaidDiagram({ chart, className = '' }: MermaidDiagramProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>('');

    useEffect(() => {
        const renderDiagram = async () => {
            try {
                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'default',
                    securityLevel: 'loose',
                    flowchart: {
                        useMaxWidth: true,
                        htmlLabels: true,
                        curve: 'basis',
                    },
                });

                const { svg: renderedSvg } = await mermaid.render(
                    `mermaid-${Date.now()}`,
                    chart
                );
                setSvg(renderedSvg);
            } catch (error) {
                console.error('Error rendering Mermaid diagram:', error);
            }
        };

        renderDiagram();
    }, [chart]);

    return (
        <div
            ref={containerRef}
            className={className}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}

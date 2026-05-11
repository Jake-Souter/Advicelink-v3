import { forwardRef, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

/**
 * Layout primitives — the only thing route/feature files may use directly.
 * Visual choices (colour, type, radius, shadow, motion) live inside semantic
 * components (REBUILD_PLAN §11.6.1, §11.6.3 Layer 1).
 */

type SpaceToken = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;

interface BaseProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children?: ReactNode;
  className?: string;
}

const gapToClass: Record<SpaceToken, string> = {
  0: 'gap-0',
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
  8: 'gap-8',
  10: 'gap-10',
  12: 'gap-12',
  16: 'gap-16',
};

export type BoxProps = BaseProps;

export const Box = forwardRef<HTMLElement, BoxProps>(function Box(
  { as: Tag = 'div', className, children, ...rest },
  ref,
) {
  return (
    <Tag ref={ref} className={className} {...rest}>
      {children}
    </Tag>
  );
});

export interface StackProps extends BaseProps {
  gap?: SpaceToken;
  align?: 'start' | 'center' | 'end' | 'stretch';
}

export const Stack = forwardRef<HTMLElement, StackProps>(function Stack(
  { as: Tag = 'div', gap = 4, align = 'stretch', className, children, ...rest },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={clsx(
        'flex flex-col',
        gapToClass[gap],
        align === 'start' && 'items-start',
        align === 'center' && 'items-center',
        align === 'end' && 'items-end',
        align === 'stretch' && 'items-stretch',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export interface InlineProps extends BaseProps {
  gap?: SpaceToken;
  align?: 'start' | 'center' | 'end' | 'baseline';
  wrap?: boolean;
}

export const Inline = forwardRef<HTMLElement, InlineProps>(function Inline(
  { as: Tag = 'div', gap = 2, align = 'center', wrap = false, className, children, ...rest },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={clsx(
        'flex flex-row',
        gapToClass[gap],
        wrap && 'flex-wrap',
        align === 'start' && 'items-start',
        align === 'center' && 'items-center',
        align === 'end' && 'items-end',
        align === 'baseline' && 'items-baseline',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export interface ClusterProps extends BaseProps {
  gap?: SpaceToken;
  justify?: 'start' | 'center' | 'end' | 'between';
}

export const Cluster = forwardRef<HTMLElement, ClusterProps>(function Cluster(
  { as: Tag = 'div', gap = 2, justify = 'start', className, children, ...rest },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={clsx(
        'flex flex-row flex-wrap items-center',
        gapToClass[gap],
        justify === 'start' && 'justify-start',
        justify === 'center' && 'justify-center',
        justify === 'end' && 'justify-end',
        justify === 'between' && 'justify-between',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export interface GridProps extends BaseProps {
  cols?: 1 | 2 | 3 | 4 | 6 | 12;
  gap?: SpaceToken;
}

export const Grid = forwardRef<HTMLElement, GridProps>(function Grid(
  { as: Tag = 'div', cols = 12, gap = 4, className, children, ...rest },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={clsx(
        'grid',
        cols === 1 && 'grid-cols-1',
        cols === 2 && 'grid-cols-2',
        cols === 3 && 'grid-cols-3',
        cols === 4 && 'grid-cols-4',
        cols === 6 && 'grid-cols-6',
        cols === 12 && 'grid-cols-12',
        gapToClass[gap],
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export interface SpacerProps {
  size?: SpaceToken;
}

export function Spacer({ size = 4 }: SpacerProps): ReactNode {
  return <div aria-hidden className={clsx('block', `h-${size}`)} />;
}

export function VisuallyHidden({ children }: { children: ReactNode }): ReactNode {
  return (
    <span className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]">
      {children}
    </span>
  );
}

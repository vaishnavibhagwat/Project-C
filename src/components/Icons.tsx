import type { SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Builds a 16px stroke icon from path data. Icons are decorative unless given a title. */
function createIcon(name: string, paths: string[]) {
  function Icon({ size = 16, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    );
  }
  Icon.displayName = name;
  return Icon;
}

export const IconGrid = createIcon('IconGrid', [
  'M3 3h7v7H3z',
  'M14 3h7v4h-7z',
  'M14 10h7v11h-7z',
  'M3 13h7v8H3z',
]);
export const IconShield = createIcon('IconShield', [
  'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z',
  'M9 12l2 2 4-4',
]);
export const IconLayers = createIcon('IconLayers', [
  'M12 3l9 5-9 5-9-5z',
  'M3 13l9 5 9-5',
  'M3 17.5l9 5 9-5',
]);
export const IconTrendingUp = createIcon('IconTrendingUp', ['M3 17l6-6 4 4 8-8', 'M15 7h6v6']);
export const IconNews = createIcon('IconNews', [
  'M4 5h13v14H6a2 2 0 0 1-2-2z',
  'M17 9h3v8a2 2 0 0 1-2 2',
  'M8 9h5',
  'M8 13h5',
  'M8 17h3',
]);
export const IconStore = createIcon('IconStore', [
  'M4 9l1.5-5h13L20 9',
  'M4 9h16v2a3 3 0 0 1-5.3 2 3 3 0 0 1-5.4 0A3 3 0 0 1 4 11z',
  'M5 13v8h14v-8',
  'M10 21v-5h4v5',
]);
export const IconSearch = createIcon('IconSearch', [
  'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
  'M21 21l-4.3-4.3',
]);
export const IconBell = createIcon('IconBell', [
  'M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6',
  'M10 19a2 2 0 0 0 4 0',
]);
export const IconUser = createIcon('IconUser', [
  'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  'M4 21a8 8 0 0 1 16 0',
]);
export const IconSettings = createIcon('IconSettings', [
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
]);
export const IconRefresh = createIcon('IconRefresh', [
  'M21 12a9 9 0 0 1-15.5 6.2',
  'M3 12A9 9 0 0 1 18.5 5.8',
  'M18 2v4h-4',
  'M6 22v-4h4',
]);
export const IconCopy = createIcon('IconCopy', ['M9 9h11v11H9z', 'M5 15H4V4h11v1']);
export const IconClose = createIcon('IconClose', ['M6 6l12 12', 'M18 6L6 18']);
export const IconInfo = createIcon('IconInfo', [
  'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  'M12 11v5',
  'M12 8h.01',
]);
export const IconPlus = createIcon('IconPlus', ['M12 5v14', 'M5 12h14']);
export const IconLock = createIcon('IconLock', ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4']);
export const IconUnlock = createIcon('IconUnlock', ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 7.5-2']);
export const IconSave = createIcon('IconSave', ['M5 3h11l3 3v15H5z', 'M8 3v5h7V3', 'M8 21v-7h8v7']);
export const IconShare = createIcon('IconShare', [
  'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'M8.6 13.5l6.8 4',
  'M15.4 6.5l-6.8 4',
]);
export const IconPalette = createIcon('IconPalette', [
  'M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-2a2 2 0 0 0-1.5 3.3c.6.7.2 2.7-2.5 2.7z',
  'M7.5 10.5h.01',
  'M10.5 7h.01',
  'M15 7.5h.01',
]);
export const IconChevronDown = createIcon('IconChevronDown', ['M6 9l6 6 6-6']);
export const IconCheck = createIcon('IconCheck', ['M5 12l5 5 9-10']);
export const IconWifiOff = createIcon('IconWifiOff', [
  'M2 2l20 20',
  'M8.5 16.5a5 5 0 0 1 7 0',
  'M5 12.6a10 10 0 0 1 5.2-2.5',
  'M2 8.8a15 15 0 0 1 4.2-2.6',
  'M16.7 10.6A10 10 0 0 1 19 12.6',
  'M10.7 5.1A15 15 0 0 1 22 8.8',
  'M12 20h.01',
]);
export const IconAlert = createIcon('IconAlert', [
  'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  'M12 9v4',
  'M12 17h.01',
]);
export const IconLineChart = createIcon('IconLineChart', ['M3 3v18h18', 'M7 15l4-4 3 3 5-6']);
export const IconAreaChart = createIcon('IconAreaChart', ['M3 3v18h18', 'M7 14l4-3 3 2 5-5v8H7z']);
export const IconPie = createIcon('IconPie', [
  'M21 12A9 9 0 1 1 12 3v9z',
  'M15 3.5A9 9 0 0 1 20.5 9H15z',
]);
export const IconTable = createIcon('IconTable', [
  'M3 4h18v16H3z',
  'M3 9h18',
  'M3 14h18',
  'M9 4v16',
]);
export const IconFeed = createIcon('IconFeed', [
  'M4 11a9 9 0 0 1 9 9',
  'M4 4a16 16 0 0 1 16 16',
  'M5 19h.01',
]);
export const IconGauge = createIcon('IconGauge', ['M12 14l4-4', 'M3.3 17a9 9 0 1 1 17.4 0']);
export const IconHeatmap = createIcon('IconHeatmap', [
  'M3 3h5v5H3z',
  'M10 3h5v5h-5z',
  'M17 3h4v5h-4z',
  'M3 10h5v5H3z',
  'M10 10h5v5h-5z',
  'M17 10h4v5h-4z',
  'M3 17h5v4H3z',
  'M10 17h5v4h-5z',
  'M17 17h4v4h-4z',
]);
export const IconTreemap = createIcon('IconTreemap', [
  'M3 3h18v18H3z',
  'M12 3v18',
  'M12 12h9',
  'M16 12v9',
]);
export const IconBars = createIcon('IconBars', [
  'M3 21h18',
  'M6 17V9',
  'M11 17V5',
  'M16 17v-6',
  'M21 17v-3',
]);
export const IconTiles = createIcon('IconTiles', [
  'M3 5h8v6H3z',
  'M13 5h8v6h-8z',
  'M3 13h8v6H3z',
  'M13 13h8v6h-8z',
]);
export const IconTrash = createIcon('IconTrash', [
  'M4 7h16',
  'M10 11v6',
  'M14 11v6',
  'M6 7l1 13h10l1-13',
  'M9 7V4h6v3',
]);
export const IconHistory = createIcon('IconHistory', [
  'M3 12a9 9 0 1 0 3-6.7L3 8',
  'M3 3v5h5',
  'M12 7v5l3 2',
]);
export const IconDownload = createIcon('IconDownload', ['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14']);
export const IconUpload = createIcon('IconUpload', ['M12 21V9', 'M7 14l5-5 5 5', 'M5 3h14']);
export const IconDrag = createIcon('IconDrag', [
  'M9 5h.01',
  'M9 12h.01',
  'M9 19h.01',
  'M15 5h.01',
  'M15 12h.01',
  'M15 19h.01',
]);
export const IconUndo = createIcon('IconUndo', ['M9 14L4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10h-3']);
export const IconRedo = createIcon('IconRedo', ['M15 14l5-5-5-5', 'M20 9H9a5 5 0 0 0 0 10h3']);
export const IconPencil = createIcon('IconPencil', ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4']);
export const IconRotate = createIcon('IconRotate', ['M3 12a9 9 0 1 0 2.6-6.4L3 8', 'M3 3v5h5']);
export const IconLink = createIcon('IconLink', [
  'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1',
  'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
]);
export const IconPlug = createIcon('IconPlug', [
  'M9 2v6',
  'M15 2v6',
  'M6 8h12v4a6 6 0 0 1-12 0z',
  'M12 18v4',
]);
export const IconExternal = createIcon('IconExternal', [
  'M14 4h6v6',
  'M20 4l-9 9',
  'M18 14v6H4V6h6',
]);

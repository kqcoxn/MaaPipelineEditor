/* tslint:disable */
/* eslint-disable */

import React, { CSSProperties, SVGAttributes, FunctionComponent } from 'react';
import { getIconColor } from './helper';

interface Props extends Omit<SVGAttributes<SVGElement>, 'color'> {
  size?: number;
  color?: string | string[];
}

const DEFAULT_STYLE: CSSProperties = {
  display: 'block',
};

const IconLiuchengtu: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M544 240v64h288v-64H544z m-64 48H368c-8.8 0-16-7.2-16-16s7.2-16 16-16h112v-16c0-35.3 28.7-64 64-64h288c35.3 0 64 28.7 64 64v64c0 35.3-28.7 64-64 64H544c-35.3 0-64-28.7-64-64v-16z m0 528H224c-35.3 0-64-28.7-64-64V312.8l32 46V752c0 17.7 14.3 32 32 32h256v-32c0-35.3 28.7-64 64-64h288c35.3 0 64 28.7 64 64v64c0 35.3-28.7 64-64 64H544c-35.3 0-64-28.7-64-64z m0-272H336c-35.3 0-64-28.7-64-64V343.2l32 25.9V480c0 17.7 14.3 32 32 32h144v-16c0-35.3 28.7-64 64-64h288c35.3 0 64 28.7 64 64v64c0 35.3-28.7 64-64 64H544c-35.3 0-64-28.7-64-64v-16z m64-48v64h288v-64H544z m0 256v64h288v-64H544z"
        fill={getIconColor(color, 0, '#333333')}
      />
      <path
        d="M160 240v64h160v-64H160z m0-64h160c35.3 0 64 28.7 64 64v64c0 35.3-28.7 64-64 64H160c-35.3 0-64-28.7-64-64v-64c0-35.3 28.7-64 64-64z"
        fill={getIconColor(color, 1, '#0076FF')}
      />
    </svg>
  );
};

IconLiuchengtu.defaultProps = {
  size: 18,
};

export default IconLiuchengtu;

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

const IconAApItiaoshi: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M36.928 576a128 128 0 0 1 0-128l182.144-315.392a128 128 0 0 1 110.848-64h364.16a128 128 0 0 1 110.848 64L987.072 448a128 128 0 0 1 0 128l-182.144 315.392a128 128 0 0 1-110.848 64h-364.16a128 128 0 0 1-110.848-64L36.928 576z"
        fill={getIconColor(color, 0, '#E8DFFF')}
      />
      <path
        d="M512 512m-192 0a192 192 0 1 0 384 0 192 192 0 1 0-384 0Z"
        fill={getIconColor(color, 1, '#6829FF')}
      />
    </svg>
  );
};

IconAApItiaoshi.defaultProps = {
  size: 18,
};

export default IconAApItiaoshi;

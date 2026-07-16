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

const IconWeizhihang: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M511.8 512.5m-500 0a500 500 0 1 0 1000 0 500 500 0 1 0-1000 0Z"
        fill={getIconColor(color, 0, '#CBF2F6')}
      />
      <path
        d="M508 508.8m-232.1 0a232.1 232.1 0 1 0 464.2 0 232.1 232.1 0 1 0-464.2 0Z"
        fill={getIconColor(color, 1, '#43B0C6')}
      />
    </svg>
  );
};

IconWeizhihang.defaultProps = {
  size: 18,
};

export default IconWeizhihang;

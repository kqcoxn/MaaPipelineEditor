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

const IconGengduo: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M96.723414 514.211365m-95.67913 0a95.67913 95.67913 0 1 0 191.358259 0 95.67913 95.67913 0 1 0-191.358259 0Z"
        fill={getIconColor(color, 0, '#6B6B6B')}
      />
      <path
        d="M511.999488 514.211365m-95.679129 0a95.67913 95.67913 0 1 0 191.358259 0 95.67913 95.67913 0 1 0-191.358259 0Z"
        fill={getIconColor(color, 1, '#6B6B6B')}
      />
      <path
        d="M927.275563 514.211365m-95.679129 0a95.67913 95.67913 0 1 0 191.358259 0 95.67913 95.67913 0 1 0-191.358259 0Z"
        fill={getIconColor(color, 2, '#6B6B6B')}
      />
    </svg>
  );
};

IconGengduo.defaultProps = {
  size: 18,
};

export default IconGengduo;

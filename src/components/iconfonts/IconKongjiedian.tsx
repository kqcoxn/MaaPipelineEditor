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

const IconKongjiedian: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M512 244a268 268 0 1 1-189.5 78.5A266.21 266.21 0 0 1 512 244m0-132c-220.91 0-400 179.09-400 400s179.09 400 400 400 400-179.09 400-400-179.09-400-400-400z"
        fill={getIconColor(color, 0, '#9FAABE')}
      />
    </svg>
  );
};

IconKongjiedian.defaultProps = {
  size: 18,
};

export default IconKongjiedian;

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

const IconChuizhifangda: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M511.9 400.9H236c-11 0-16.8-13.1-9.4-21.2l133-146.9L502.5 75.1c5-5.6 13.8-5.6 18.8 0l142.8 157.7 133 146.9c7.4 8.2 1.6 21.2-9.4 21.2H511.9z"
        fill={getIconColor(color, 0, '#333333')}
      />
      <path
        d="M205.3 388.1c0-7.4 2.7-14.7 8-20.5L489.2 63c5.8-6.4 14.1-10.1 22.7-10.1s16.9 3.7 22.7 10.1l275.9 304.6c8.3 9.1 10.3 21.8 5.3 33-5 11.3-15.7 18.2-28.1 18.2H236c-12.3 0-23.1-7-28.1-18.2-1.7-4-2.6-8.3-2.6-12.5zM511.9 91.5L248 382.9h527.8L511.9 91.5z"
        fill={getIconColor(color, 1, '#333333')}
      />
      <path
        d="M511.9 623.1h275.9c11 0 16.8 13.1 9.4 21.2l-133 146.9-142.8 157.7c-5 5.6-13.8 5.6-18.8 0L359.7 791.2l-133-146.9c-7.4-8.2-1.6-21.2 9.4-21.2h275.8z"
        fill={getIconColor(color, 2, '#333333')}
      />
      <path
        d="M205.3 635.9c0-4.2 0.9-8.5 2.7-12.6 5-11.3 15.7-18.2 28.1-18.2h551.7c12.3 0 23.1 7 28.1 18.2 5 11.3 3 23.9-5.3 33L534.6 961c-5.8 6.4-14.1 10.1-22.7 10.1-8.7 0-16.9-3.7-22.7-10.1L213.3 656.4c-5.3-5.8-8-13.1-8-20.5z m570.5 5.2H248l263.9 291.4 263.9-291.4z"
        fill={getIconColor(color, 3, '#333333')}
      />
    </svg>
  );
};

IconChuizhifangda.defaultProps = {
  size: 18,
};

export default IconChuizhifangda;

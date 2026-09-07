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

const IconChengjiu: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1194 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M1177.6 162.133333c-25.6-34.133333-72.533333-38.4-102.4-17.066666l-238.933333 174.933333-170.666667-285.866667c-8.533333-8.533333-17.066667-17.066667-29.866667-25.6-12.8-4.266667-25.6-8.533333-38.4-8.533333s-25.6 8.533333-34.133333 12.8c-4.266667 4.266667-21.333333 12.8-29.866667 25.6l-170.666666 285.866667-238.933334-174.933334C89.6 123.733333 42.666667 128 17.066667 162.133333 4.266667 174.933333 0 196.266667 0 213.333333l76.8 593.066667h1045.333333L1194.666667 213.333333c0-17.066667-4.266667-38.4-17.066667-51.2zM76.8 878.933333h1045.333333V1024H76.8z"
        fill={getIconColor(color, 0, '#FFC74E')}
      />
    </svg>
  );
};

IconChengjiu.defaultProps = {
  size: 18,
};

export default IconChengjiu;

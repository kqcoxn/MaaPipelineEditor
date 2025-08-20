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

const IconQianjin: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M19.236571 955.245714s10.020571 25.892571 23.405715 0c0 0 149.357714-450.706286 513.462857-337.188571v139.922286s5.851429 82.285714 77.604571 28.672l357.814857-309.028572s75.922286-41.252571-4.534857-97.865143L625.152 68.900571s-54.418286-38.765714-67.584 24.868572l-0.438857 150.893714c0.146286 0.146286-678.473143 32.694857-537.892572 710.656z"
        fill={getIconColor(color, 0, '#000000')}
        fillOpacity=".65"
      />
    </svg>
  );
};

IconQianjin.defaultProps = {
  size: 18,
};

export default IconQianjin;

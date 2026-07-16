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

const IconFanhui: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M1004.836571 955.245714s-10.093714 25.892571-23.405714 0c0 0-149.430857-450.706286-513.536-337.188571v139.922286s-5.851429 82.285714-77.604571 28.672L32.475429 477.622857s-75.922286-41.252571 4.534857-97.865143L398.848 68.900571s54.418286-38.765714 67.584 24.868572l0.438857 150.893714c-0.146286 0.146286 678.473143 32.694857 537.965714 710.656z"
        fill={getIconColor(color, 0, '#000000')}
        fillOpacity=".65"
      />
    </svg>
  );
};

IconFanhui.defaultProps = {
  size: 18,
};

export default IconFanhui;

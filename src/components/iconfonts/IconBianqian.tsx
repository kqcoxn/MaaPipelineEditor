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

const IconBianqian: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M781.33 112H362v800h419.33c44.553 0 80.67-36.118 80.67-80.67V192.67c0-44.552-36.118-80.67-80.67-80.67z"
        fill={getIconColor(color, 0, '#00A1FF')}
      />
      <path
        d="M312 112h-69.33c-44.553 0-80.67 36.118-80.67 80.67v638.66c0 44.553 36.118 80.67 80.67 80.67H312V112z"
        fill={getIconColor(color, 1, '#8BD6FC')}
      />
      <path
        d="M562 112v299.998l75-75 75 75V112z"
        fill={getIconColor(color, 2, '#FFFFFF')}
      />
    </svg>
  );
};

IconBianqian.defaultProps = {
  size: 18,
};

export default IconBianqian;

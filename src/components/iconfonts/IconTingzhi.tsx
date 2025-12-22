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

const IconTingzhi: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1025 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M385.011469 384.945105h255.606366v255.606366H385.011469V384.945105z m569.363181 384.687581l-95.213371-95.021667a386.988038 386.988038 0 1 0-184.6756 184.547796l95.213371 95.085569a511.979551 511.979551 0 1 1 184.6756-184.611698z"
        fill={getIconColor(color, 0, '#4C89FB')}
      />
    </svg>
  );
};

IconTingzhi.defaultProps = {
  size: 18,
};

export default IconTingzhi;

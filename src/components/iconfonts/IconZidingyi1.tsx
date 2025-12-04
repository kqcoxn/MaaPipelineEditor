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

const IconZidingyi1: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M512 928c-125.44 0-224-182.72-224-416s98.56-416 224-416 224 182.72 224 416-98.56 416-224 416z m0-768c-75.84 0-160 144.64-160 352s84.16 352 160 352 160-144.64 160-352-84.16-352-160-352z"
        fill={getIconColor(color, 0, '#4A8BFE')}
      />
      <path
        d="M699.52 797.76a623.04 623.04 0 0 1-299.52-91.84C198.08 589.44 88.96 412.8 151.68 304s270.4-102.72 472.32 14.08 311.04 293.12 248.32 401.92c-30.08 51.84-93.12 77.76-172.8 77.76zM324.16 290.56c-57.6 0-100.16 16.32-117.12 45.44-37.76 65.6 45.44 210.88 224 314.56s346.88 103.04 384 37.44-45.44-210.88-224-314.56a560.32 560.32 0 0 0-266.88-82.88z"
        fill={getIconColor(color, 1, '#4A8BFE')}
      />
      <path
        d="M324.48 797.76c-79.68 0-142.72-25.92-172.8-77.76-64-108.8 46.4-285.44 248.32-401.92S809.6 195.2 872.32 304s-46.4 285.44-248.32 401.92a623.04 623.04 0 0 1-299.52 91.84zM699.84 290.56a560.32 560.32 0 0 0-267.84 82.88c-179.52 103.68-262.72 248.96-224 314.56s205.44 66.24 384-37.44 262.72-248.96 224-314.56c-16-29.12-58.56-45.44-116.16-45.44z"
        fill={getIconColor(color, 2, '#4A8BFE')}
      />
      <path
        d="M512 512m-64 0a64 64 0 1 0 128 0 64 64 0 1 0-128 0Z"
        fill={getIconColor(color, 3, '#4A8BFE')}
      />
      <path
        d="M512 592a80 80 0 1 1 80-80 80 80 0 0 1-80 80z m0-128a48 48 0 1 0 48 48 48 48 0 0 0-48-48z"
        fill={getIconColor(color, 4, '#4A8BFE')}
      />
    </svg>
  );
};

IconZidingyi1.defaultProps = {
  size: 18,
};

export default IconZidingyi1;

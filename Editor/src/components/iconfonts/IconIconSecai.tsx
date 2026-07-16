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

const IconIconSecai: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M959.47 469.96C938.27 242.26 745.15 64 511.94 64 264.55 64 64 264.58 64 512s200.55 448 447.94 448c40.56 0 73.43-32.88 73.43-73.44 0-30.08-18.16-56-44.06-67.31-17.58-11.25-29.37-30.83-29.37-53.14 0-34.74 28.42-63.16 63.15-63.16h182.49v-0.17c107.07-1.71 194.41-85.19 201.89-190.78 0-3.28 0.07-6.52 0-9.79 0.04-1.64 0-3.25 0-4.9 0-9.29 1.19-18.38 0-27.35zM240.3 526.69c-44.61 0-80.78-36.17-80.78-80.79s36.17-80.79 80.78-80.79 80.77 36.17 80.77 80.79-36.16 80.79-80.77 80.79z m146.87-205.64c-44.61 0-80.78-36.17-80.78-80.79s36.16-80.79 80.78-80.79 80.78 36.17 80.78 80.79-36.17 80.79-80.78 80.79z m249.67 0c-44.61 0-80.78-36.17-80.78-80.79s36.16-80.79 80.78-80.79 80.78 36.17 80.78 80.79-36.17 80.79-80.78 80.79zM783.7 526.69c-44.61 0-80.78-36.17-80.78-80.79s36.16-80.79 80.78-80.79 80.78 36.17 80.78 80.79-36.17 80.79-80.78 80.79z"
        fill={getIconColor(color, 0, '#FFAA71')}
      />
    </svg>
  );
};

IconIconSecai.defaultProps = {
  size: 18,
};

export default IconIconSecai;

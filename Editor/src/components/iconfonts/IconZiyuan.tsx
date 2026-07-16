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

const IconZiyuan: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M512 356.173913a178.086957 178.086957 0 1 1 178.086957-178.086956 178.086957 178.086957 0 0 1-178.086957 178.086956z m0-267.130435a89.043478 89.043478 0 1 0 89.043478 89.043479 89.043478 89.043478 0 0 0-89.043478-89.043479z"
        fill={getIconColor(color, 0, '#2F3CF4')}
      />
      <path
        d="M957.217391 489.73913a44.521739 44.521739 0 0 0-44.521739-44.521739h-131.784348a45.857391 45.857391 0 0 0-44.521739 30.052174A44.521739 44.521739 0 0 0 779.130435 534.26087h86.372174A356.173913 356.173913 0 0 1 556.521739 842.796522V356.173913a44.521739 44.521739 0 0 0-43.408696-44.521739H512a44.521739 44.521739 0 0 0-44.521739 44.521739v486.622609A356.173913 356.173913 0 0 1 158.497391 534.26087h84.591305a44.521739 44.521739 0 0 0 44.521739-30.052174A44.521739 44.521739 0 0 0 244.869565 445.217391H111.304348a44.521739 44.521739 0 0 0-44.521739 44.521739 445.217391 445.217391 0 0 0 356.173913 436.090435 56.097391 56.097391 0 0 1 44.521739 54.761739A44.521739 44.521739 0 0 0 512 1024h2.226087a44.521739 44.521739 0 0 0 43.408696-44.521739 56.097391 56.097391 0 0 1 45.634782-54.761739A445.217391 445.217391 0 0 0 957.217391 489.73913z"
        fill={getIconColor(color, 1, '#2F3CF4')}
      />
      <path
        d="M333.913043 445.217391m44.52174 0l267.130434 0q44.521739 0 44.52174 44.521739l0 0q0 44.521739-44.52174 44.52174l-267.130434 0q-44.521739 0-44.52174-44.52174l0 0q0-44.521739 44.52174-44.521739Z"
        fill={getIconColor(color, 2, '#2F3CF4')}
      />
    </svg>
  );
};

IconZiyuan.defaultProps = {
  size: 18,
};

export default IconZiyuan;

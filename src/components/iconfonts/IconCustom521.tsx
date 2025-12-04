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

const IconCustom521: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M904 1024H120c-66.168 0-120-53.832-120-120V120C0 53.832 53.832 0 120 0h784c66.168 0 120 53.832 120 120v784c0 66.168-53.832 120-120 120zM120 4C56.038 4 4 56.038 4 120v784c0 63.962 52.038 116 116 116h784c63.962 0 116-52.038 116-116V120c0-63.962-52.038-116-116-116H120z"
        fill={getIconColor(color, 0, '#D8DDE3')}
      />
      <path
        d="M518.474 832.444a30 30 0 0 1-28.596-20.904l-132.812-417.436a30.006 30.006 0 0 1 37.684-37.684l417.438 132.814a30 30 0 0 1 5.592 54.748L642.852 642.2c-24.192 48.088-95.262 169.864-98.48 175.376a30.006 30.006 0 0 1-25.898 14.868z m-86.646-401.266l94.64 297.46c24.98-43.588 56.262-99.034 66.198-120.396a29.874 29.874 0 0 1 13.014-13.982l122.514-68.79-296.366-94.292z"
        fill={getIconColor(color, 1, '#20263B')}
      />
      <path
        d="M340.774 522.064c-1.282 0-2.576-0.082-3.878-0.25-90.606-11.698-154.804-94.928-143.108-185.534 5.666-43.892 28.086-82.95 63.128-109.98 35.044-27.03 78.518-38.792 122.406-33.128 74.436 9.608 133.262 68.29 143.056 142.704 2.162 16.426-9.404 31.496-25.83 33.658-16.426 2.16-31.496-9.402-33.658-25.83-6.248-47.464-43.77-84.896-91.25-91.026-28-3.614-55.726 3.89-78.078 21.13-22.352 17.242-36.654 42.156-40.268 70.152-7.46 57.794 33.49 110.884 91.284 118.346 16.432 2.122 28.034 17.162 25.912 33.594-1.954 15.13-14.858 26.164-29.716 26.164z"
        fill={getIconColor(color, 2, '#FF4B07')}
      />
    </svg>
  );
};

IconCustom521.defaultProps = {
  size: 18,
};

export default IconCustom521;

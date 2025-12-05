import React from 'react'
import './LoadingFrame.less'

const LoadingFrame: React.FC = () => {
  return (
    <div className="loading-frame">
      <div className="loading-spinner" />
      <div className="loading-text">服主太穷了服务器比较垃圾，下载资源中qAq...</div>
    </div>
  )
}

export default LoadingFrame

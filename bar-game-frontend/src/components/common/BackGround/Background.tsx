import { useState, useEffect, useRef } from 'react';
import './Background.less';
import placeholderImg from "../../../assets/屏幕截图 2025-11-24 172718.png";
import bg from "../../../assets/CozyMCwinter.mp4";

export default function Background() {
    const [showVideo, setShowVideo] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const loadVideo = () => {
            if (videoRef.current) {
                videoRef.current.src = bg;
                videoRef.current.load();
            }
        };

        const handleVideoLoad = () => {
            setShowVideo(true);
        };

        if (videoRef.current) {
            videoRef.current.addEventListener('canplay', handleVideoLoad);
        }

        if ('requestIdleCallback' in window) {
            requestIdleCallback(loadVideo);
        } else {
            // Fallback for browsers without requestIdleCallback
            setTimeout(loadVideo, 0);
        }

        return () => {
            if (videoRef.current) {
                videoRef.current.removeEventListener('canplay', handleVideoLoad);
            }
        };
    }, []);

    return (
        <div className="background">
            {!showVideo && (
                <img src={placeholderImg} className="background-media" alt="background placeholder" />
            )}
            <video
                ref={videoRef}
                className="background-media"
                autoPlay
                loop
                muted
                style={{ display: showVideo ? 'block' : 'none' }}
            />
        </div>
    );
}

import { SpinnerGap } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

type LoadingInlineProps = {
  show: boolean
  label?: string
  className?: string
  animatedExit?: boolean
}

export default function LoadingInline({
  show,
  label = 'Loading...',
  className = '',
  animatedExit = true,
}: LoadingInlineProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={animatedExit ? { opacity: 0, x: 4 } : { opacity: 0 }}
          transition={{ duration: animatedExit ? 0.2 : 0 }}
          className={`inline-flex items-center gap-2 ${className}`}
        >
          <SpinnerGap className="animate-spin" size={16} />
          <span>{label}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import * as envalid from 'envalid'
import dotenv from 'dotenv'

dotenv.config()

export default envalid.cleanEnv(process.env, {
  PERSONA_TITLE: envalid.str({ default: 'Veritable Cloudagent' }),
  PERSONA_COLOR: envalid.str({ default: 'white' }),
})

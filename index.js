const express = require('express')
const app = express()

app.use('/test', (req, res,next)=>{
    res.send('success change')
})



app.listen(process.env.PORT || 8001)


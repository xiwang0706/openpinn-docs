普通 PINN（``plain_pinn``）
============================

.. openpinn-method-summary:: baseline plain_pinn

为什么要保留它
--------------

普通 PINN 是所有改进方法的对照组。只有在控制方程、训练点、网络规模、步数和随机种子
保持一致时，改进组与普通组的误差和时间差异才有解释意义。

最短调用
--------

.. code-block:: python

   import openpinn as op

   result = op.solve(
       "poisson", method="baseline", variant="plain_pinn", steps=5000
   )

适用边界
--------

* 新方程先用普通 PINN 做短训练，确认残差、边界和保存链路都正常；
* 正式比较时先保存普通组，再只改变一个改进组件；
* 普通 PINN 能运行不代表已经收敛，仍需检查误差、残差、训练时间和多随机种子结果。
